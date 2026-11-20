import "server-only";
import type { NotificationKind } from "@prisma/client";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { clip, sendSms, smsConfigFromEnv } from "@/lib/sms";

type Student = { id: string; firstName: string; firstNameAr: string | null };
type School = { id: string; nameFr: string; nameAr: string; defaultLocale: Locale };

/**
 * Prépare et envoie une alerte au contact principal de chaque élève
 * (dans la langue de son compte, sinon celle de l'école).
 * Un parent avec plusieurs enfants concernés reçoit un message par enfant.
 */
export async function alertGuardiansOf(
  school: School,
  studentIds: string[],
  kind: NotificationKind,
  text: (d: Dictionary, lang: Locale, vars: { school: string; student: string }) => string,
  { oncePerGuardian = false } = {},
) {
  if (studentIds.length === 0) return;
  const links = await db.studentGuardian.findMany({
    where: { studentId: { in: studentIds }, guardian: { schoolId: school.id } },
    include: { guardian: { include: { user: true } }, student: true },
    orderBy: { isPrimary: "desc" },
  });
  const chosen = new Map<string, (typeof links)[number]>();
  const seenGuardians = new Set<string>();
  for (const l of links) {
    if (chosen.has(l.studentId) || !(l.guardian.phone || l.guardian.whatsapp)) continue;
    if (oncePerGuardian && seenGuardians.has(l.guardianId)) continue;
    chosen.set(l.studentId, l);
    seenGuardians.add(l.guardianId);
  }
  const dicts = { fr: await getDictionary("fr"), ar: await getDictionary("ar") };
  const rows = [...chosen.values()].map((l) => {
    const lang: Locale = l.guardian.user?.preferredLocale ?? school.defaultLocale;
    const s: Student = l.student;
    return {
      schoolId: school.id,
      guardianId: l.guardianId,
      kind,
      toPhone: (l.guardian.phone ?? l.guardian.whatsapp)!,
      body: clip(
        text(dicts[lang], lang, {
          school: lang === "ar" ? school.nameAr : school.nameFr,
          student: lang === "ar" && s.firstNameAr ? s.firstNameAr : s.firstName,
        }),
      ),
    };
  });
  await queueAndSend(rows);
}

/** Alerte directe à un parent (par ex. nouveau message de l'école). */
export async function alertGuardian(
  school: School,
  guardianId: string,
  kind: NotificationKind,
  text: (d: Dictionary, lang: Locale, vars: { school: string }) => string,
) {
  const g = await db.guardian.findFirst({ where: { id: guardianId, schoolId: school.id }, include: { user: true } });
  const phone = g?.phone ?? g?.whatsapp;
  if (!g || !phone) return;
  const lang: Locale = g.user?.preferredLocale ?? school.defaultLocale;
  const d = await getDictionary(lang);
  await queueAndSend([
    { schoolId: school.id, guardianId: g.id, kind, toPhone: phone, body: clip(text(d, lang, { school: lang === "ar" ? school.nameAr : school.nameFr })) },
  ]);
}

type Row = { schoolId: string; guardianId: string; kind: NotificationKind; toPhone: string; body: string };

async function queueAndSend(rows: Row[]) {
  if (rows.length === 0) return;
  const config = smsConfigFromEnv();
  // On enregistre d'abord (trace), puis on envoie ; un échec n'empêche pas l'action de l'utilisateur.
  const created = await db.$transaction(rows.map((data) => db.notification.create({ data })));
  await Promise.all(
    created.map(async (n) => {
      const r = await sendSms(config, n.toPhone, n.body);
      await db.notification.update({
        where: { id: n.id },
        data: { status: r.status, error: r.error ?? null, attempts: { increment: 1 }, sentAt: r.status === "FAILED" ? null : new Date() },
      });
    }),
  );
}

/** Renvoie les alertes en échec d'une école. */
export async function retryFailed(schoolId: string) {
  const config = smsConfigFromEnv();
  const failed = await db.notification.findMany({ where: { schoolId, status: "FAILED", attempts: { lt: 5 } }, take: 100 });
  for (const n of failed) {
    const r = await sendSms(config, n.toPhone, n.body);
    await db.notification.update({
      where: { id: n.id },
      data: { status: r.status, error: r.error ?? null, attempts: { increment: 1 }, sentAt: r.status === "FAILED" ? null : new Date() },
    });
  }
  return failed.length;
}

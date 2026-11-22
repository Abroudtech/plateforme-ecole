import "server-only";
import type { NotificationKind } from "@prisma/client";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { clip, sendSms, smsConfigFromEnv } from "@/lib/sms";

type Student = { id: string; firstName: string; firstNameAr: string | null };
type School = { id: string; nameFr: string; nameAr: string; defaultLocale: Locale; smsOnlyWithoutApp?: boolean };

/** Page ouverte quand le parent touche la notification. */
const PAGE: Record<NotificationKind, string> = {
  ABSENCE: "tableau-de-bord",
  REPORT_CARD: "tableau-de-bord",
  ANNOUNCEMENT: "annonces",
  MESSAGE: "messages",
  PAYMENT: "tableau-de-bord",
};

/**
 * Prépare et envoie une alerte au contact principal de chaque élève
 * (dans la langue de son compte, sinon celle de l'école) : notification sur
 * le téléphone si le parent a activé l'application, et SMS.
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
    include: { guardian: { include: { user: { include: { _count: { select: { pushSubscriptions: true } } } } } }, student: true },
    orderBy: { isPrimary: "desc" },
  });
  const chosen = new Map<string, (typeof links)[number]>();
  const seenGuardians = new Set<string>();
  for (const l of links) {
    const reachable = l.guardian.phone || l.guardian.whatsapp || (l.guardian.user?._count.pushSubscriptions ?? 0) > 0;
    if (chosen.has(l.studentId) || !reachable) continue;
    if (oncePerGuardian && seenGuardians.has(l.guardianId)) continue;
    chosen.set(l.studentId, l);
    seenGuardians.add(l.guardianId);
  }
  const dicts = { fr: await getDictionary("fr"), ar: await getDictionary("ar") };
  const rows = [...chosen.values()].map((l) => {
    const lang: Locale = l.guardian.user?.preferredLocale ?? school.defaultLocale;
    const s: Student = l.student;
    return {
      lang,
      userId: l.guardian.user?.isActive ? l.guardian.user.id : null,
      hasApp: (l.guardian.user?._count.pushSubscriptions ?? 0) > 0,
      sms: {
        schoolId: school.id,
        guardianId: l.guardianId,
        kind,
        toPhone: l.guardian.phone ?? l.guardian.whatsapp,
        body: clip(
          text(dicts[lang], lang, {
            school: lang === "ar" ? school.nameAr : school.nameFr,
            student: lang === "ar" && s.firstNameAr ? s.firstNameAr : s.firstName,
          }),
        ),
      },
    };
  });
  await deliver(school, kind, rows);
}

/** Alerte directe à un parent (par ex. nouveau message de l'école). */
export async function alertGuardian(
  school: School,
  guardianId: string,
  kind: NotificationKind,
  text: (d: Dictionary, lang: Locale, vars: { school: string }) => string,
) {
  const g = await db.guardian.findFirst({
    where: { id: guardianId, schoolId: school.id },
    include: { user: { include: { _count: { select: { pushSubscriptions: true } } } } },
  });
  if (!g) return;
  const lang: Locale = g.user?.preferredLocale ?? school.defaultLocale;
  const d = await getDictionary(lang);
  await deliver(school, kind, [
    {
      lang,
      userId: g.user?.isActive ? g.user.id : null,
      hasApp: (g.user?._count.pushSubscriptions ?? 0) > 0,
      sms: {
        schoolId: school.id,
        guardianId: g.id,
        kind,
        toPhone: g.phone ?? g.whatsapp,
        body: clip(text(d, lang, { school: lang === "ar" ? school.nameAr : school.nameFr })),
      },
    },
  ]);
}

type Row = { schoolId: string; guardianId: string; kind: NotificationKind; toPhone: string; body: string };
type Delivery = { lang: Locale; userId: string | null; hasApp: boolean; sms: Omit<Row, "toPhone"> & { toPhone: string | null } };

/**
 * Notifications sur le téléphone, puis SMS (sauf si l'école a choisi de ne pas
 * envoyer de SMS aux parents qui ont l'application). L'envoi se fait après la
 * réponse : la direction n'attend pas la fin des envois.
 */
async function deliver(school: School, kind: NotificationKind, rows: Delivery[]) {
  if (rows.length === 0) return;
  const smsRows = rows
    .filter((r) => r.sms.toPhone && !(school.smsOnlyWithoutApp && r.hasApp))
    .map((r) => ({ ...r.sms, toPhone: r.sms.toPhone! }));
  // On enregistre d'abord (trace), puis on envoie ; un échec n'empêche pas l'action de l'utilisateur.
  const created = smsRows.length ? await db.$transaction(smsRows.map((data) => db.notification.create({ data }))) : [];
  const pushes = rows.filter((r) => r.userId && r.hasApp);
  later(async () => {
    await Promise.all(
      pushes.map((r) =>
        sendPush([r.userId!], {
          title: r.lang === "ar" ? school.nameAr : school.nameFr,
          body: r.sms.body,
          url: `/${r.lang}/${PAGE[kind]}`,
          tag: kind,
        }),
      ),
    );
    await sendQueued(created);
  });
}

/** Exécute après la réponse si possible (requête en cours), sinon tout de suite. */
function later(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

async function sendQueued(created: { id: string; toPhone: string; body: string }[]) {
  const config = smsConfigFromEnv();
  // Par paquets de 10, pour ne pas saturer la passerelle SMS.
  for (let i = 0; i < created.length; i += 10) {
    await Promise.all(
      created.slice(i, i + 10).map(async (n) => {
        const r = await sendSms(config, n.toPhone, n.body);
        await db.notification.update({
          where: { id: n.id },
          data: { status: r.status, error: r.error ?? null, attempts: { increment: 1 }, sentAt: r.status === "FAILED" ? null : new Date() },
        });
      }),
    );
  }
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

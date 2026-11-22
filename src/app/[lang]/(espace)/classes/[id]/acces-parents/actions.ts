"use server";

import { headers } from "next/headers";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { provisionGuardianAccess } from "@/lib/auth/guardian-access";
import { db } from "@/lib/db";
import { sendSms, smsConfigFromEnv } from "@/lib/sms";

export type BulkRow = { student: string; guardian: string; login: string; password: string | null; status: string; smsSent?: boolean };
export type BulkState = { rows?: BulkRow[]; error?: string } | undefined;

/**
 * Crée d'un coup les accès manquants des parents d'une classe (contact
 * principal de chaque élève). Les mots de passe ne s'affichent qu'une fois :
 * la page propose de les imprimer, et peut aussi les envoyer par SMS.
 */
export async function createClassAccesses(rawLang: string, classId: string, _prev: BulkState, formData: FormData): Promise<BulkState> {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requirePermission(lang, "students.write");
  const cls = await db.classGroup.findFirst({
    where: { id: classId, schoolId: ctx.school.id },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { student: { include: { guardians: { include: { guardian: true }, orderBy: { isPrimary: "desc" } } } } },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      },
    },
  });
  if (!cls) return { error: "notFound" };
  const withSms = formData.get("sms") === "on";
  const sms = smsConfigFromEnv();
  const host = (await headers()).get("host");
  const site = host ? `https://${host}` : "";
  const seen = new Set<string>();
  const rows: BulkRow[] = [];

  for (const { student } of cls.enrollments) {
    const link = student.guardians.find((g) => g.guardian.phone || g.guardian.email);
    if (!link) {
      rows.push({ student: personName(student, lang), guardian: "", login: "", password: null, status: "noContact" });
      continue;
    }
    const g = link.guardian;
    // Frères et sœurs : un seul accès par parent.
    if (seen.has(g.id) || g.userId) {
      rows.push({ student: personName(student, lang), guardian: personName(g, lang), login: "", password: null, status: "exists" });
      seen.add(g.id);
      continue;
    }
    seen.add(g.id);
    const r = await provisionGuardianAccess(ctx.school, g, { resetExisting: false });
    const row: BulkRow = {
      student: personName(student, lang),
      guardian: personName(g, lang),
      login: "login" in r ? r.login : "",
      password: "password" in r ? r.password : null,
      status: r.status,
    };
    if (withSms && sms && row.password && g.phone) {
      const d = await getDictionary(ctx.school.defaultLocale);
      const res = await sendSms(sms, g.phone, t(d.bulkAccess.smsText, { school: ctx.school.nameFr, login: row.login, password: row.password, site }));
      row.smsSent = res.status === "SENT";
    }
    rows.push(row);
  }
  return { rows };
}

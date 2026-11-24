"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { schoolAdminIds, sendPush } from "@/lib/push";

export type InquiryState = { ok?: boolean; error?: "invalid" | "busy" } | undefined;

const schema = z.object({
  parentName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  email: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || z.email().safeParse(v).success),
  childLevel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  message: z.string().trim().min(2).max(2000),
});

/** Plus de demandes que ça en une heure pour une école : on suppose un abus. */
const HOURLY_LIMIT = 30;

/**
 * Demande de renseignements envoyée depuis la page vitrine publique
 * (sans compte). La direction la retrouve dans « Site de l'école ».
 */
export async function sendSiteInquiry(schoolId: string, _prev: InquiryState, formData: FormData): Promise<InquiryState> {
  // Champ caché que seuls les robots remplissent : on fait semblant d'avoir reçu.
  if (String(formData.get("website") ?? "")) return { ok: true };

  const site = await db.schoolSite.findUnique({ where: { schoolId }, include: { school: true } });
  if (!site?.published || !site.inquiryForm || !site.school.isActive) return { error: "invalid" };

  const raw = Object.fromEntries(["parentName", "phone", "email", "childLevel", "message"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "invalid" };

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.siteInquiry.count({ where: { schoolId, createdAt: { gt: since } } });
  if (recent >= HOURLY_LIMIT) return { error: "busy" };
  // Même famille qui renvoie le formulaire (double clic, retour arrière) : pas de doublon.
  const duplicate = await db.siteInquiry.findFirst({ where: { schoolId, phone, message: parsed.data.message, createdAt: { gt: since } } });
  if (duplicate) return { ok: true };

  await db.siteInquiry.create({ data: { schoolId, ...parsed.data, phone } });
  const school = site.school;
  const name = parsed.data.parentName;
  after(async () => {
    const lang = school.defaultLocale;
    await sendPush(await schoolAdminIds(school.id), {
      title: lang === "ar" ? school.nameAr : school.nameFr,
      body: lang === "ar" ? `طلب جديد من الموقع: ${name}` : `Nouvelle demande depuis le site : ${name}`,
      url: `/${lang}/site-vitrine#demandes`,
      tag: "site-inquiry",
    });
  });
  return { ok: true };
}

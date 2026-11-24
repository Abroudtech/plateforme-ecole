"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Prisma, SitePhotoKind } from "@prisma/client";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { FormError } from "@/lib/forms";
import { normalizePhone } from "@/lib/phone";
import { isSiteTheme } from "@/lib/site/themes";
import { MAX_GALLERY_PHOTOS, MAX_HIGHLIGHTS, MAX_PHOTO_BYTES, detectImageType, normalizeUrl } from "@/lib/site/content";

/** Texte facultatif (vide devient null), plus long que les champs ordinaires. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v.replace(/\r\n/g, "\n") : null));

/** Enregistre une partie de la vitrine (la ligne est créée au premier enregistrement). */
async function saveSite(schoolId: string, data: Prisma.SchoolSiteUncheckedUpdateInput) {
  await db.schoolSite.upsert({
    where: { schoolId },
    update: data,
    create: { ...(data as Prisma.SchoolSiteUncheckedCreateInput), schoolId },
  });
}

export async function saveSitePublished(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    await saveSite(ctx.school.id, { published: formData.get("published") === "on" });
    refresh();
  });
}

export async function saveSiteTheme(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const theme = String(formData.get("theme") ?? "");
    if (!isSiteTheme(theme)) throw new FormError("invalid");
    await saveSite(ctx.school.id, { theme });
    refresh();
  });
}

export async function saveSiteHero(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const data = parseForm(z.object({ heroTitleFr: text(120), heroTitleAr: text(120), heroTextFr: text(300), heroTextAr: text(300) }), formData);
    await saveSite(ctx.school.id, data);
    refresh();
  });
}

export async function saveSiteAbout(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const data = parseForm(z.object({ aboutFr: text(4000), aboutAr: text(4000) }), formData);
    await saveSite(ctx.school.id, data);
    refresh();
  });
}

export async function saveSiteAdmissions(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const data = parseForm(z.object({ admissionsFr: text(3000), admissionsAr: text(3000) }), formData);
    await saveSite(ctx.school.id, data);
    refresh();
  });
}

export async function saveSiteHighlights(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const highlights = Array.from({ length: MAX_HIGHLIGHTS }, (_, i) => ({
      titleFr: get(`titleFr${i}`).slice(0, 80),
      titleAr: get(`titleAr${i}`).slice(0, 80),
      textFr: get(`textFr${i}`).slice(0, 400),
      textAr: get(`textAr${i}`).slice(0, 400),
    })).filter((h) => h.titleFr || h.titleAr || h.textFr || h.textAr);
    await saveSite(ctx.school.id, { highlights });
    refresh();
  });
}

export async function saveSiteCycles(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const get = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 400);
    const cycleTexts: Record<string, { fr: string; ar: string }> = {};
    for (const c of ctx.school.cycles) cycleTexts[c] = { fr: get(`${c}Fr`), ar: get(`${c}Ar`) };
    await saveSite(ctx.school.id, { cycleTexts });
    refresh();
  });
}

export async function saveSiteContact(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const data = parseForm(
      z.object({ hoursFr: text(200), hoursAr: text(200), whatsapp: text(30), facebookUrl: text(300), instagramUrl: text(300), mapUrl: text(600) }),
      formData,
    );
    const whatsapp = data.whatsapp ? normalizePhone(data.whatsapp) : null;
    if (data.whatsapp && !whatsapp) throw new FormError("phoneInvalid");
    const links = { facebookUrl: normalizeUrl(data.facebookUrl), instagramUrl: normalizeUrl(data.instagramUrl), mapUrl: normalizeUrl(data.mapUrl) };
    for (const [k, v] of Object.entries(links)) if (data[k as keyof typeof links] && !v) throw new FormError("urlInvalid");
    await saveSite(ctx.school.id, { hoursFr: data.hoursFr, hoursAr: data.hoursAr, whatsapp, ...links, inquiryForm: formData.get("inquiryForm") === "on" });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Photos (logo, grande photo d'accueil, galerie)
// ---------------------------------------------------------------------------

export async function uploadSitePhoto(lang: string, kind: SitePhotoKind, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new FormError("photoMissing");
    if (file.size > MAX_PHOTO_BYTES) throw new FormError("photoTooBig");
    const data = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectImageType(data);
    if (!mimeType) throw new FormError("photoType");
    const captionFr = String(formData.get("captionFr") ?? "").trim().slice(0, 160) || null;
    const captionAr = String(formData.get("captionAr") ?? "").trim().slice(0, 160) || null;

    if (kind === "GALLERY") {
      const count = await db.sitePhoto.count({ where: { schoolId, kind } });
      if (count >= MAX_GALLERY_PHOTOS) throw new FormError("tooManyPhotos");
      const last = await db.sitePhoto.aggregate({ where: { schoolId, kind }, _max: { position: true } });
      await db.sitePhoto.create({ data: { schoolId, kind, data, mimeType, captionFr, captionAr, position: (last._max.position ?? -1) + 1 } });
    } else {
      // Un seul logo et une seule grande photo : la nouvelle remplace l'ancienne.
      await db.$transaction([
        db.sitePhoto.deleteMany({ where: { schoolId, kind } }),
        db.sitePhoto.create({ data: { schoolId, kind, data, mimeType } }),
      ]);
    }
    refresh();
  });
}

export async function deleteSitePhoto(lang: string, photoId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    await db.sitePhoto.deleteMany({ where: { id: photoId, schoolId: ctx.school.id } });
    refresh();
  });
}

export async function saveSitePhotoCaption(lang: string, photoId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const captionFr = String(formData.get("captionFr") ?? "").trim().slice(0, 160) || null;
    const captionAr = String(formData.get("captionAr") ?? "").trim().slice(0, 160) || null;
    await db.sitePhoto.updateMany({ where: { id: photoId, schoolId: ctx.school.id }, data: { captionFr, captionAr } });
    refresh();
  });
}

/** Échange la place d'une photo de la galerie avec sa voisine. */
export async function moveSitePhoto(lang: string, photoId: string, direction: -1 | 1, _prev: FormState, _fd: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    const photos = await db.sitePhoto.findMany({
      where: { schoolId: ctx.school.id, kind: "GALLERY" },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const i = photos.findIndex((p) => p.id === photoId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= photos.length) return;
    [photos[i], photos[j]] = [photos[j], photos[i]];
    await db.$transaction(photos.map((p, position) => db.sitePhoto.update({ where: { id: p.id }, data: { position } })));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Demandes des familles
// ---------------------------------------------------------------------------

export async function setInquiryHandled(lang: string, inquiryId: string, handled: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "site.write", async (ctx) => {
    await db.siteInquiry.updateMany({ where: { id: inquiryId, schoolId: ctx.school.id }, data: { handledAt: handled ? new Date() : null } });
    refresh();
  });
}

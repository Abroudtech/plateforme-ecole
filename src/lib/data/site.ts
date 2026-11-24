import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/site/content";

// Photos sans leur contenu (les octets sont servis par /api/vitrine/photo/[id]).
const photoFields = { id: true, kind: true, captionFr: true, captionAr: true, position: true } as const;

/** Tout ce qu'il faut pour afficher la page vitrine d'une école. */
async function loadSite(schoolId: string) {
  const [school, site, photos] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId } }),
    db.schoolSite.findUnique({ where: { schoolId } }),
    db.sitePhoto.findMany({ where: { schoolId }, select: photoFields, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  if (!school) return null;
  return {
    school,
    site,
    logo: photos.find((p) => p.kind === "LOGO") ?? null,
    hero: photos.find((p) => p.kind === "HERO") ?? null,
    gallery: photos.filter((p) => p.kind === "GALLERY"),
  };
}

export type SiteData = NonNullable<Awaited<ReturnType<typeof loadSite>>>;

/** Réglages de la vitrine pour l'administration (la ligne est créée au premier enregistrement). */
export function getSiteForAdmin(schoolId: string) {
  return loadSite(schoolId);
}

/** Vitrine par l'identifiant de l'école dans l'adresse (/fr/ecole/<slug>). */
export async function getSiteBySlug(slug: string) {
  const school = await db.school.findUnique({ where: { slug }, select: { id: true, isActive: true } });
  if (!school?.isActive) return null;
  return loadSite(school.id);
}

/** Adresse par laquelle la personne arrive (ex. « laplume-dor.tn »). */
export async function requestDomain(): Promise<string | null> {
  const h = await headers();
  return normalizeDomain(h.get("x-forwarded-host")?.split(",")[0] ?? h.get("host"));
}

/** Vitrine publiée rattachée au domaine visité, s'il y en a une. */
export async function getSiteForRequestDomain() {
  const domain = await requestDomain();
  if (!domain) return null;
  const site = await db.schoolSite.findUnique({ where: { domain }, select: { schoolId: true, published: true, school: { select: { isActive: true } } } });
  if (!site?.published || !site.school.isActive) return null;
  return loadSite(site.schoolId);
}

export function siteInquiries(schoolId: string) {
  return db.siteInquiry.findMany({ where: { schoolId }, orderBy: [{ handledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 100 });
}

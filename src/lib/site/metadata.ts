import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { pickName } from "@/i18n/localized";
import type { SiteData } from "@/lib/data/site";
import { pickText } from "./content";

/** Titre, description et image de partage (Facebook, WhatsApp) de la page vitrine. */
export function siteMetadata(data: SiteData, lang: Locale): Metadata {
  const name = pickName(data.school, lang);
  const description = pickText(data.site?.heroTextFr, data.site?.heroTextAr, lang) || pickText(data.site?.aboutFr, data.site?.aboutAr, lang).slice(0, 200) || name;
  const image = data.hero ?? data.gallery[0] ?? null;
  return {
    title: name,
    description,
    icons: data.logo ? { icon: `/api/vitrine/photo/${data.logo.id}` } : undefined,
    openGraph: { title: name, description, type: "website", images: image ? [`/api/vitrine/photo/${image.id}`] : undefined },
    robots: data.site?.published ? undefined : { index: false },
  };
}

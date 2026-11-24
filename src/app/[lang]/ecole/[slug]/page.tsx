import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOptionalContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getSiteBySlug } from "@/lib/data/site";
import { siteMetadata } from "@/lib/site/metadata";
import { SchoolSite } from "@/components/site/school-site";

/**
 * Page vitrine d'une école à l'adresse de la plateforme : /fr/ecole/<école>.
 * Sert aussi d'aperçu à la direction tant que la page n'est pas publiée.
 */
async function load(slug: string) {
  const data = await getSiteBySlug(slug);
  if (!data) return null;
  if (data.site?.published) return { data, preview: false };
  const ctx = await getOptionalContext();
  if (ctx?.school?.id === data.school.id && can(ctx.roles, "site.write")) return { data, preview: true };
  return null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/ecole/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const found = await load(slug);
  return found ? siteMetadata(found.data, lang as Locale) : {};
}

export default async function SchoolSitePage({ params }: PageProps<"/[lang]/ecole/[slug]">) {
  const { lang: raw, slug } = await params;
  const lang = raw as Locale;
  const dict = await getDictionary(lang);
  const found = await load(slug);
  if (!found) notFound();
  const other = lang === "fr" ? "ar" : "fr";
  return <SchoolSite data={found.data} lang={lang} dict={dict} preview={found.preview} otherLangHref={`/${other}/ecole/${slug}`} />;
}

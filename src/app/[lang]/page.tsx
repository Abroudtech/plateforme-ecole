import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOptionalContext } from "@/lib/auth/context";
import { getSiteForRequestDomain } from "@/lib/data/site";
import { siteMetadata } from "@/lib/site/metadata";
import { SchoolSite } from "@/components/site/school-site";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const site = await getSiteForRequestDomain();
  return site ? siteMetadata(site, lang as Locale) : {};
}

// Page d'accueil.
// - Sur l'adresse propre d'une école (ex. laplume-dor.tn) : sa page vitrine.
// - Sinon : tableau de bord si la personne est connectée, page de connexion sinon.
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const site = await getSiteForRequestDomain();
  if (site) {
    const dict = await getDictionary(lang);
    return <SchoolSite data={site} lang={lang as Locale} dict={dict} otherLangHref={lang === "fr" ? "/ar" : "/fr"} />;
  }
  const ctx = await getOptionalContext();
  redirect(ctx?.school ? `/${lang}/tableau-de-bord` : `/${lang}/connexion`);
}

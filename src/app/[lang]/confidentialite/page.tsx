import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { legal } from "@/lib/mobile/legal";
import { LegalPage } from "@/components/legal-page";

// Page publique exigée par le Play Store et l'App Store.
// Lue à chaque visite pour afficher l'adresse de contact réglée sur Render.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/confidentialite">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: legal[lang].privacyTitle } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/confidentialite">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage lang={lang} kind="privacy" />;
}

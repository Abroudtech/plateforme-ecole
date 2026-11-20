import Link from "next/link";
import type { Locale } from "@/i18n/config";

/** Lien pour passer du français à l'arabe (et inversement) sur la même page. */
export function LanguageSwitch({ lang, path, label }: { lang: Locale; path: string; label: string }) {
  const other: Locale = lang === "fr" ? "ar" : "fr";
  return (
    <Link
      href={`/${other}${path}`}
      lang={other}
      className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}

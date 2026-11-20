"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Lien pour passer du français à l'arabe (et inversement) en restant sur la même page. */
export function LanguageSwitch({ lang, label, className = "border-slate-300 hover:bg-slate-100" }: { lang: Locale; label: string; className?: string }) {
  const other: Locale = lang === "fr" ? "ar" : "fr";
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.replace(/^\/(fr|ar)(?=\/|$)/, "");
  return (
    <Link
      href={`/${other}${rest}${search ? `?${search}` : ""}`}
      lang={other}
      className={`rounded-full border px-3 py-1 text-sm font-medium ${className}`}
    >
      {label}
    </Link>
  );
}

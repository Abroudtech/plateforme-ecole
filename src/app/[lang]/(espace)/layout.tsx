import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { navFor } from "@/lib/nav";
import { logout, switchSchool } from "@/app/actions/session";
import { BottomNav, TopNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";

// Cadre commun à toutes les pages après connexion : en-tête bleu nuit avec
// l'école, menu en haut sur ordinateur et barre d'onglets en bas sur téléphone.
export default async function SpaceLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const nav = navFor(ctx.roles, lang, dict);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-blue-900 text-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}/tableau-de-bord`} className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={34} />
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight">{pickName(ctx.school, lang)}</span>
              <span className="block truncate text-xs text-white/65">{ctx.roles.map((r) => dict.roles[r]).join(" · ")}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {ctx.user.isPlatformAdmin && (
              <Link href={`/${lang}/plateforme`} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                {dict.platform.title}
              </Link>
            )}
            {can(ctx.roles, "students.read") && (
              <Link
                href={`/${lang}/recherche`}
                title={dict.search.title}
                aria-label={dict.search.title}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
              >
                <Search size={17} aria-hidden />
              </Link>
            )}
            <LanguageSwitch lang={lang} label={dict.language.switchTo} className="border-white/25 text-white hover:bg-white/10" />
            <form action={logout.bind(null, lang)}>
              <button
                title={dict.nav.logout}
                aria-label={dict.nav.logout}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
              >
                <LogOut size={17} className="rtl:rotate-180" aria-hidden />
              </button>
            </form>
          </div>
        </div>
        <TopNav items={nav.all} />
        {ctx.schools.length > 1 && (
          <form action={switchSchool.bind(null, lang)} className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-3 text-sm">
            <label htmlFor="schoolId" className="text-white/70">{dict.nav.school}</label>
            <select
              id="schoolId"
              name="schoolId"
              defaultValue={ctx.school.id}
              className="min-w-0 flex-1 rounded-lg border border-white/25 bg-blue-800 px-2 py-1 text-white"
            >
              {ctx.schools.map((s) => (
                <option key={s.id} value={s.id}>{pickName(s, lang)}</option>
              ))}
            </select>
            <button className="rounded-lg border border-white/25 px-2 py-1">{dict.nav.switchSchool}</button>
          </form>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:pb-10 print:p-0">{children}</main>
      <BottomNav items={nav.bottom} />
    </div>
  );
}

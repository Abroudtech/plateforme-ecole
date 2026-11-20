import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { logout, switchSchool } from "@/app/actions/session";
import { LanguageSwitch } from "@/components/language-switch";

// Cadre commun à toutes les pages après connexion : en-tête avec l'école,
// le choix de langue et la déconnexion. Pensé d'abord pour le téléphone.
export default async function SpaceLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b print:hidden border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}/tableau-de-bord`} className="min-w-0">
            <p className="truncate text-base font-bold">{pickName(ctx.school, lang)}</p>
            <p className="truncate text-xs text-slate-500">
              {ctx.roles.map((r) => dict.roles[r]).join(" · ")}
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitch lang={lang} label={dict.language.switchTo} />
            <form action={logout.bind(null, lang)}>
              <button className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700">
                {dict.nav.logout}
              </button>
            </form>
          </div>
        </div>
        {can(ctx.roles, "students.read") && (
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm font-medium">
            {[
              { href: "tableau-de-bord", label: dict.nav.dashboard },
              { href: "eleves", label: dict.nav.students },
              { href: "classes", label: dict.nav.classes },
              { href: "absences", label: dict.nav.attendance },
              { href: "emplois-du-temps", label: dict.nav.timetables },
              ...(can(ctx.roles, "payments.read") ? [{ href: "paiements", label: dict.nav.payments }] : []),
              ...(can(ctx.roles, "messages.school") ? [{ href: "messages", label: dict.nav.messages }] : []),
              ...(can(ctx.roles, "settings.write") ? [{ href: "parametres", label: dict.nav.settings }] : []),
              { href: "mon-compte", label: dict.account.title },
            ].map((item) => (
              <Link key={item.href} href={`/${lang}/${item.href}`} className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {ctx.schools.length > 1 && (
          <form
            action={switchSchool.bind(null, lang)}
            className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-3 text-sm"
          >
            <label htmlFor="schoolId" className="text-slate-600">{dict.nav.school}</label>
            <select
              id="schoolId"
              name="schoolId"
              defaultValue={ctx.school.id}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1"
            >
              {ctx.schools.map((s) => (
                <option key={s.id} value={s.id}>{pickName(s, lang)}</option>
              ))}
            </select>
            <button className="rounded-lg border border-slate-300 px-2 py-1">{dict.nav.switchSchool}</button>
          </form>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

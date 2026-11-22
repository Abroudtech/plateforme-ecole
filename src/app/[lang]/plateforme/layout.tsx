import Link from "next/link";
import { LogOut } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { logout } from "@/app/actions/session";
import { BrandMark } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";

/** Espace de l'équipe de la plateforme : les écoles clientes et leurs abonnements. */
export default async function PlatformLayout({ children, params }: LayoutProps<"/[lang]/plateforme">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePlatformAdmin(lang);
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-blue-950 text-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${lang}/plateforme`} className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={34} />
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight">{dict.platform.title}</span>
              <span className="block truncate text-xs text-white/65">{ctx.user.firstName} {ctx.user.lastName}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {ctx.school && (
              <Link href={`/${lang}/tableau-de-bord`} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">{dict.platform.mySchool}</Link>
            )}
            <LanguageSwitch lang={lang} label={dict.language.switchTo} className="border-white/25 text-white hover:bg-white/10" />
            <form action={logout.bind(null, lang)}>
              <button title={dict.nav.logout} aria-label={dict.nav.logout} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20">
                <LogOut size={17} className="rtl:rotate-180" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getOptionalContext } from "@/lib/auth/context";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandMark } from "@/components/brand";
import { legal } from "@/lib/mobile/legal";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/connexion">) {
  const { lang } = await params;
  const { erreur, reinit } = await searchParams;
  const dict = await getDictionary(lang);

  const ctx = await getOptionalContext();
  if (ctx?.school) redirect(`/${lang}/tableau-de-bord`);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-blue-900 px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-gold-500/10" />
      <div aria-hidden className="pointer-events-none absolute -start-20 bottom-10 h-56 w-56 rounded-full bg-gold-500/10" />
      <div className="relative mb-6 flex w-full max-w-sm items-center justify-between">
        <span className="flex items-center gap-2.5 text-white">
          <BrandMark size={40} />
          <span className="font-display text-lg font-semibold">{dict.app.name}</span>
        </span>
        <LanguageSwitch lang={lang as Locale} label={dict.language.switchTo} className="border-white/25 text-white hover:bg-white/10" />
      </div>
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h1 className="font-display text-[1.7rem] font-semibold text-blue-900">{dict.login.title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">{dict.login.subtitle}</p>
        {reinit === "1" && (
          <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{dict.reset.done}</p>
        )}
        {erreur === "acces" && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {dict.login.noAccess}
          </p>
        )}
        <LoginForm
          lang={lang}
          labels={{
            identifier: dict.login.identifier,
            password: dict.login.password,
            showPassword: dict.login.showPassword,
            hidePassword: dict.login.hidePassword,
            submit: dict.login.submit,
            submitting: dict.login.submitting,
            errors: {
              invalid: dict.login.invalid,
              missingFields: dict.login.missingFields,
              tooMany: dict.login.tooMany,
              noAccess: dict.login.noAccess,
            },
          }}
        />
        <a href={`/${lang}/mot-de-passe-oublie`} className="mt-4 block text-center text-sm font-medium text-blue-800 underline">
          {dict.reset.link}
        </a>
      </div>
      <nav className="relative mt-5 flex gap-4 text-xs text-white/70">
        <a href={`/${lang}/confidentialite`} className="underline hover:text-white">{legal[lang as Locale].privacyLink}</a>
        <a href={`/${lang}/suppression-compte`} className="underline hover:text-white">{legal[lang as Locale].deletionLink}</a>
      </nav>
    </main>
  );
}

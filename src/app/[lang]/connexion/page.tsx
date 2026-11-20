import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getOptionalContext } from "@/lib/auth/context";
import { LanguageSwitch } from "@/components/language-switch";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/connexion">) {
  const { lang } = await params;
  const { erreur } = await searchParams;
  const dict = await getDictionary(lang);

  const ctx = await getOptionalContext();
  if (ctx?.school) redirect(`/${lang}/tableau-de-bord`);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex w-full max-w-sm justify-end">
        <LanguageSwitch lang={lang as Locale} path="/connexion" label={dict.language.switchTo} />
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-blue-700">{dict.app.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{dict.login.title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">{dict.login.subtitle}</p>
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
            submit: dict.login.submit,
            submitting: dict.login.submitting,
            errors: {
              invalid: dict.login.invalid,
              missingFields: dict.login.missingFields,
              noAccess: dict.login.noAccess,
            },
          }}
        />
      </div>
    </main>
  );
}

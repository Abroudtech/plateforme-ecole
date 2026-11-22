import { connection } from "next/server";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { BrandMark } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { ResetForm } from "./reset-form";

/** Mot de passe oublié : code par SMS, ou demande transmise à l'école. */
export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/mot-de-passe-oublie">) {
  const { lang } = await params;
  await connection();
  const dict = await getDictionary(lang);
  const r = dict.reset;
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-blue-900 px-4 py-10">
      <div className="relative mb-6 flex w-full max-w-sm items-center justify-between">
        <span className="flex items-center gap-2.5 text-white">
          <BrandMark size={40} />
          <span className="font-display text-lg font-semibold">{dict.app.name}</span>
        </span>
        <LanguageSwitch lang={lang as Locale} label={dict.language.switchTo} className="border-white/25 text-white hover:bg-white/10" />
      </div>
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h1 className="font-display text-[1.6rem] font-semibold text-blue-900">{r.title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">{r.subtitle}</p>
        <ResetForm
          lang={lang}
          labels={{
            identifier: dict.login.identifier,
            send: r.send,
            sending: r.sending,
            codeSent: r.codeSent,
            code: r.code,
            next: dict.account.new,
            confirm: dict.account.confirm,
            hint: dict.account.hint,
            save: r.save,
            schoolSent: r.schoolSent,
            back: r.back,
            errors: {
              missing: dict.login.missingFields,
              tooMany: r.tooMany,
              codeInvalid: r.codeInvalid,
              passwordTooShort: dict.formErrors.passwordTooShort,
              passwordMismatch: dict.formErrors.passwordMismatch,
            },
          }}
        />
      </div>
    </main>
  );
}

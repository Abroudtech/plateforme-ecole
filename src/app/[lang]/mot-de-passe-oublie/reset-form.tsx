"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmReset, requestReset, type ResetState } from "./actions";

type Labels = {
  identifier: string; send: string; sending: string; codeSent: string; code: string; next: string; confirm: string; hint: string;
  save: string; schoolSent: string; back: string;
  errors: Record<NonNullable<NonNullable<ResetState>["error"]>, string>;
};

const input = "rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-gold-500 focus:ring-3 focus:ring-gold-200/70";

export function ResetForm({ lang, labels }: { lang: string; labels: Labels }) {
  const [asked, ask, asking] = useActionState(requestReset.bind(null, lang), undefined);
  const [done, confirm, saving] = useActionState(confirmReset.bind(null, lang), undefined);
  const state = done ?? asked;
  const error = state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{labels.errors[state.error]}</p>;
  const backLink = <Link href={`/${lang}/connexion`} className="text-center text-sm font-medium text-blue-800 underline">{labels.back}</Link>;

  if (asked?.step === "school") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-900">{labels.schoolSent}</p>
        {backLink}
      </div>
    );
  }

  if (asked?.step === "code") {
    return (
      <form action={confirm} className="flex flex-col gap-4">
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{labels.codeSent}</p>
        <input type="hidden" name="identifier" value={done?.identifier ?? asked.identifier ?? ""} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.code}
          <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} dir="ltr" className={`${input} tracking-[0.4em]`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.next}
          <input name="next" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={input} />
          <span className="text-xs font-normal text-slate-500">{labels.hint}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.confirm}
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={input} />
        </label>
        {error}
        <button disabled={saving} className="rounded-xl bg-blue-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">{labels.save}</button>
        {backLink}
      </form>
    );
  }

  return (
    <form action={ask} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {labels.identifier}
        <input name="identifier" required autoComplete="username" dir="auto" className={input} />
      </label>
      {error}
      <button disabled={asking} className="rounded-xl bg-blue-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
        {asking ? labels.sending : labels.send}
      </button>
      {backLink}
    </form>
  );
}

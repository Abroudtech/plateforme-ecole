"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

type Labels = {
  identifier: string;
  password: string;
  submit: string;
  submitting: string;
  errors: Record<NonNullable<NonNullable<LoginState>["error"]>, string>;
};

export function LoginForm({ lang, labels }: { lang: string; labels: Labels }) {
  const [state, action, pending] = useActionState(login.bind(null, lang), undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {labels.identifier}
        <input
          name="identifier"
          autoComplete="username"
          required
          dir="auto"
          className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-gold-500 focus:ring-3 focus:ring-gold-200/70"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {labels.password}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-gold-500 focus:ring-3 focus:ring-gold-200/70"
        />
      </label>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {labels.errors[state.error]}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-blue-900 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}

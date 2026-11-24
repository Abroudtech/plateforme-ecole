"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "./actions";

type Labels = {
  identifier: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  submitting: string;
  errors: Record<NonNullable<NonNullable<LoginState>["error"]>, string>;
};

export function LoginForm({ lang, labels }: { lang: string; labels: Labels }) {
  const [state, action, pending] = useActionState(login.bind(null, lang), undefined);
  const [visible, setVisible] = useState(false);

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
        {/* Bouton « œil » : vérifier ce qu'on tape, utile sur téléphone. */}
        <span className="relative">
          <input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-slate-300 bg-white py-3 ps-3 pe-12 text-base outline-none focus:border-gold-500 focus:ring-3 focus:ring-gold-200/70"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? labels.hidePassword : labels.showPassword}
            title={visible ? labels.hidePassword : labels.showPassword}
            className="absolute inset-y-0 end-0 grid w-12 place-items-center text-slate-500 hover:text-blue-900"
          >
            {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        </span>
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

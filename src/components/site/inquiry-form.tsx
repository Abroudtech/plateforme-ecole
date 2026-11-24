"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { sendSiteInquiry, type InquiryState } from "@/app/actions/site-inquiry";

type Labels = {
  name: string;
  phone: string;
  email: string;
  emailHint: string;
  level: string;
  levelHint: string;
  message: string;
  send: string;
  sending: string;
  sent: string;
  error: string;
  busy: string;
};

const field =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-base outline-none transition focus:border-[var(--site-accent)] focus:ring-3 focus:ring-[var(--site-accent)]/25";

/** Formulaire « Demande de renseignements » de la page vitrine (sans compte). */
export function InquiryForm({ schoolId, labels }: { schoolId: string; labels: Labels }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(sendSiteInquiry.bind(null, schoolId), undefined);

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 px-5 py-10 text-center">
        <CheckCircle2 size={40} className="text-[var(--site-primary)]" aria-hidden />
        <p className="max-w-sm text-lg font-medium">{labels.sent}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.name}
          <input name="parentName" required minLength={2} maxLength={100} autoComplete="name" dir="auto" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.phone}
          <input name="phone" type="tel" required maxLength={30} autoComplete="tel" dir="ltr" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>
            {labels.email} <span className="font-normal opacity-60">({labels.emailHint})</span>
          </span>
          <input name="email" type="email" maxLength={150} autoComplete="email" dir="ltr" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {labels.level}
          <input name="childLevel" maxLength={80} dir="auto" placeholder={labels.levelHint} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {labels.message}
        <textarea name="message" required minLength={2} maxLength={2000} rows={4} dir="auto" className={field} />
      </label>
      {/* Piège à robots : invisible pour les personnes. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error === "busy" ? labels.busy : labels.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-[var(--site-primary)] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? labels.sending : labels.send}
      </button>
    </form>
  );
}

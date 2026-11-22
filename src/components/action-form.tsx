"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";

/**
 * Résultat renvoyé par une action de formulaire côté serveur.
 * `error` est une clé de traduction (voir `formErrors` dans les dictionnaires).
 */
export type FormState =
  | { ok?: boolean; error?: string; errorParams?: Record<string, string>; credentials?: { login: string; password: string }; notice?: string }
  | undefined;

type Labels = {
  submit: string;
  pending: string;
  saved?: string;
  errors: Record<string, string>;
  credentials?: { intro: string; login: string; password: string };
};

/**
 * Formulaire relié à une action serveur : affiche l'attente, les erreurs et
 * la confirmation, sans recharger la page.
 */
export function ActionForm({
  action,
  labels,
  children,
  className = "flex flex-col gap-4",
  variant = "primary",
  confirm,
  resetOnSuccess = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  labels: Labels;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
  /** Vider le formulaire après un enregistrement réussi (formulaires d'ajout). */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  const styles = {
    primary: "bg-blue-900 text-white shadow-sm hover:bg-blue-800",
    secondary: "border border-slate-300 bg-white hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];

  return (
    <form
      ref={formRef}
      className={className}
      // On envoie le formulaire nous-mêmes pour que les champs gardent leur
      // contenu en cas d'erreur (sinon il faudrait tout ressaisir).
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {(labels.errors[state.error] ?? labels.errors.invalid).replace(/\{(\w+)\}/g, (m, k: string) => state.errorParams?.[k] ?? m)}
        </p>
      )}
      {state?.ok && state.notice && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{labels.errors[state.notice] ?? labels.saved}</p>
      )}
      {state?.ok && labels.saved && !state.credentials && !state.notice && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{labels.saved}</p>
      )}
      {state?.credentials && labels.credentials && (
        <div role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
          <p>{labels.credentials.intro}</p>
          <p className="mt-1">
            {labels.credentials.login} : <bdi dir="ltr" className="font-mono font-semibold">{state.credentials.login}</bdi>
          </p>
          <p>
            {labels.credentials.password} : <bdi dir="ltr" className="font-mono font-semibold">{state.credentials.password}</bdi>
          </p>
        </div>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${styles}`}
        >
          {pending ? labels.pending : labels.submit}
        </button>
      </div>
    </form>
  );
}

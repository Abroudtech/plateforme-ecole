import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Petits composants d'interface réutilisés partout, pour garder un style
// cohérent et adapté au téléphone (gros champs, gros boutons).

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span>
        {label}
        {hint && <span className="ms-1 font-normal text-slate-500">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input dir="auto" {...props} className={fieldClass} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={fieldClass} />;
}

export function Button({ variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    secondary: "border border-slate-300 bg-white hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${styles} ${props.className ?? ""}`}
    />
  );
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-block rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
      {children}
    </Link>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: ReactNode; back?: { href: string; label: string }; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="text-sm text-blue-700 hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

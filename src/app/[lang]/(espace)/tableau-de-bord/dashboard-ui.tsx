import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Petits éléments communs aux tableaux de bord (direction, parent, enseignant, élève).

/** Bandeau bleu nuit d'accueil, dans le prolongement de l'en-tête sur téléphone. */
export function Hero({ hello, line, chip, overlap }: { hello: string; line: ReactNode; chip?: ReactNode; overlap?: boolean }) {
  return (
    <section
      className={`relative -mx-4 -mt-6 overflow-hidden rounded-b-[28px] bg-blue-900 px-5 pt-4 text-white md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-8 ${overlap ? "pb-20 md:pb-24" : "pb-8"}`}
    >
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-10 h-56 w-56 rounded-full bg-gold-500/10" />
      <div aria-hidden className="pointer-events-none absolute end-24 top-24 h-24 w-24 rounded-full bg-gold-500/10" />
      <h1 className="relative font-display text-[1.9rem] leading-tight font-semibold md:text-4xl">{hello}</h1>
      <p className="relative mt-1 text-white/75 first-letter:uppercase">{line}</p>
      {chip && <div className="relative mt-4">{chip}</div>}
    </section>
  );
}

export type Tone = "blue" | "red" | "gold" | "green";
export const TONES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-900",
  red: "bg-red-50 text-red-700",
  gold: "bg-gold-100 text-gold-800",
  green: "bg-emerald-50 text-emerald-700",
};

export function IconBadge({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
      <Icon size={19} aria-hidden />
    </span>
  );
}

export function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80 sm:p-5 ${className}`}>
      <h2 className="mb-3 text-base font-bold text-blue-900">{title}</h2>
      {children}
    </section>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-900 text-xs font-bold text-gold-300">{letters}</span>;
}

export function Notice({ text }: { text: string }) {
  return <p className="rounded-2xl bg-gold-50 p-4 text-gold-900 ring-1 ring-gold-200">{text}</p>;
}

import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { requireClassAccess } from "@/lib/auth/scope";
import { parseISODate, todayISO } from "@/lib/dates";
import { getClass } from "@/lib/data/classes";
import { listJournals } from "@/lib/data/journal";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { JournalSheet } from "../../journal-sheet";

/** Impression du journal (un jour ou une semaine) : une page A4 en paysage par journée. */
export default async function JournalPrintPage({ params, searchParams }: PageProps<"/[lang]/journal/[classId]/imprimer">) {
  const { lang: rawLang, classId } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const L = dict.journal;
  const ctx = await requirePermission(lang, "journal.read");
  await requireClassAccess(lang, ctx, classId);
  const cls = await getClass(ctx.school.id, classId);
  if (!cls) notFound();

  const from = (typeof sp.du === "string" && parseISODate(sp.du)) || parseISODate(todayISO())!;
  let to = (typeof sp.au === "string" && parseISODate(sp.au)) || from;
  if (to < from) to = from;
  // Au plus un mois à la fois.
  if (to.getTime() - from.getTime() > 31 * 86400000) to = new Date(from.getTime() + 31 * 86400000);
  const isAdmin = ctx.roles.includes("ADMIN");
  const journals = await listJournals(ctx.school.id, classId, from, to, isAdmin ? null : ctx.user.id, lang);

  return (
    <div className="flex flex-col gap-4">
      <style>{"@page { size: A4 landscape; margin: 8mm; } @media print { .journal-sheet { break-after: page; } .journal-sheet:last-child { break-after: auto; } }"}</style>
      <div className="flex flex-col gap-2 print:hidden">
        <PageHeader
          title={`${L.title} · ${className(cls, lang)}`}
          subtitle={pickName(cls.gradeLevel, lang)}
          back={{ href: `/${lang}/journal/${classId}?date=${from.toISOString().slice(0, 10)}`, label: L.title }}
          action={journals.length > 0 ? <PrintButton label={L.print} /> : undefined}
        />
        <p className="text-sm text-slate-500">{L.printHint}</p>
      </div>
      {journals.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">{L.nothingToPrint}</p>
      ) : (
        <div className="flex flex-col gap-6 print:gap-0">
          {journals.map((j) => (
            <JournalSheet key={j.id} data={{ ...j, className: className(cls, lang) }} lang={lang} L={L} schoolName={pickName(ctx.school, lang)} />
          ))}
        </div>
      )}
    </div>
  );
}

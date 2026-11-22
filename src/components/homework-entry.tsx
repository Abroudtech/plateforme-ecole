import Link from "next/link";
import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import type { HomeworkItem } from "@/lib/data/homework";

export function formatDay(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

/** Une séance du cahier de textes : matière, ce qui a été fait, travail à faire, document joint. */
export function HomeworkEntry({ item, lang, dict, showDate = false, showAuthor = false, actions }: { item: HomeworkItem; lang: Locale; dict: Dictionary; showDate?: boolean; showAuthor?: boolean; actions?: ReactNode }) {
  const h = dict.homework;
  return (
    <article className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold text-blue-900">
          {item.subject ? pickName(item.subject, lang) : h.general}
          {showDate && <span className="font-normal text-slate-500"> · {formatDay(item.date, lang)}</span>}
        </p>
        {showAuthor && item.author && <p className="text-xs text-slate-500">{personName(item.author, lang)}</p>}
      </header>
      {item.lesson && (
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700" dir="auto">
          <span className="font-medium text-slate-500">{h.lesson} : </span>
          {item.lesson}
        </p>
      )}
      {item.task && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-200">
          <p className="text-xs font-semibold text-amber-800">
            {h.task}
            {item.dueDate && <> · {t(h.dueOn, { date: formatDay(item.dueDate, lang) })}</>}
          </p>
          <p className="whitespace-pre-wrap" dir="auto">{item.task}</p>
        </div>
      )}
      {item.resource && (
        <Link href={`/${lang}/devoirs/document/${item.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:underline">
          <FileText size={15} aria-hidden /> {item.resource.title}
        </Link>
      )}
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}

/** Vue parent / élève : le travail à faire, puis les dernières séances. */
export function StudentHomework({ data, lang, dict }: { data: NonNullable<Awaited<ReturnType<typeof import("@/lib/data/homework").homeworkForStudent>>> | null; lang: Locale; dict: Dictionary }) {
  const h = dict.homework;
  if (!data) return <p className="text-sm text-slate-500">{h.noClass}</p>;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
        <h2 className="mb-3 font-bold">{h.upcoming}</h2>
        {data.upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">{h.noUpcoming}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.upcoming.map((it) => (
              <HomeworkEntry key={it.id} item={it} lang={lang} dict={dict} />
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
        <h2 className="mb-3 font-bold">{h.recent}</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-slate-500">{h.none}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.recent.map((it) => (
              <HomeworkEntry key={it.id} item={it} lang={lang} dict={dict} showDate />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

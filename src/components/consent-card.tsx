import { CalendarClock, CircleCheck, CircleX } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import type { consentsForParent } from "@/lib/data/consents";
import { answerConsent } from "@/app/[lang]/(espace)/autorisations/actions";
import { ActionForm } from "./action-form";
import { formatDay } from "./homework-entry";

type Row = Awaited<ReturnType<typeof consentsForParent>>[number];

/** Une demande d'autorisation côté parent : deux grands boutons, Oui ou Non. */
export function ConsentCard({ row, lang, dict, closed, multiChild }: { row: Row; lang: Locale; dict: Dictionary; closed: boolean; multiChild: boolean }) {
  const c = dict.consents;
  const { request: r, student, reply } = row;
  const labels = (submit: string) => ({ submit, pending: "…", errors: dict.formErrors as Record<string, string> });
  return (
    <article className={`rounded-2xl p-4 ring-1 ${reply ? "bg-white ring-slate-200" : "bg-gold-50 ring-gold-300"}`}>
      {multiChild && <p className="text-xs font-semibold text-blue-800">{t(c.for, { name: personName(student, lang) })}</p>}
      <h3 className="font-bold leading-snug" dir="auto">{r.title}</h3>
      {r.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700" dir="auto">{r.details}</p>}
      {r.deadline && (
        <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${closed ? "text-slate-500" : "text-amber-800"}`}>
          <CalendarClock size={13} aria-hidden /> {closed ? c.closed : t(c.before, { date: formatDay(r.deadline, lang) })}
        </p>
      )}
      {reply && (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${reply.accepted ? "text-emerald-700" : "text-red-700"}`}>
          {reply.accepted ? <CircleCheck size={16} aria-hidden /> : <CircleX size={16} aria-hidden />}
          {t(c.youAnswered, { answer: reply.accepted ? c.yesShort : c.noShort })}
        </p>
      )}
      {!closed && (
        <div className="mt-3 flex gap-2">
          {(!reply || !reply.accepted) && (
            <ActionForm action={answerConsent.bind(null, lang, r.id, student.id, true)} labels={labels(reply ? `${c.change} : ${c.yesShort}` : c.yes)} className="flex-1 [&_button]:w-full [&_button]:bg-emerald-600 [&_button:hover]:bg-emerald-700 [&_button]:py-3 [&_button]:text-base" />
          )}
          {(!reply || reply.accepted) && (
            <ActionForm action={answerConsent.bind(null, lang, r.id, student.id, false)} labels={labels(reply ? `${c.change} : ${c.noShort}` : c.no)} variant="secondary" className="flex-1 [&_button]:w-full [&_button]:py-3 [&_button]:text-base" />
          )}
        </div>
      )}
    </article>
  );
}

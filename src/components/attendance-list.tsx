import type { AttendanceRecord } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { setJustification } from "@/app/[lang]/(espace)/absences/actions";
import { ActionForm } from "./action-form";

/** Liste d'absences/retards avec, pour l'administration, le bouton de justification. */
export function AttendanceList({
  records,
  dict,
  lang,
  canWrite,
  renderLabel,
}: {
  records: AttendanceRecord[];
  dict: Dictionary;
  lang: Locale;
  canWrite: boolean;
  renderLabel: (r: AttendanceRecord) => React.ReactNode;
}) {
  const a = dict.attendance;
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  if (records.length === 0) return <p className="text-sm text-slate-500">{a.none}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {records.map((r) => (
        <li key={r.id} className="rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{renderLabel(r)}</div>
              <p className="text-xs text-slate-500">
                {dateFmt.format(r.date)} · {a.periods[r.period]}
                {r.reason && ` · ${r.reason}`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${r.status === "ABSENT" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                {a.statuses[r.status]}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${r.justified ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>
                {r.justified ? a.justified : a.unjustified}
              </span>
            </div>
          </div>
          {canWrite && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-blue-700">
                {r.justified ? a.unjustify : a.justify}
              </summary>
              <ActionForm
                action={setJustification.bind(null, lang, r.id, !r.justified)}
                labels={formLabels(dict, r.justified ? a.unjustify : a.justify)}
                variant={r.justified ? "secondary" : "primary"}
                className="mt-2 flex flex-col gap-2"
              >
                {!r.justified && (
                  <input
                    name="reason"
                    maxLength={200}
                    dir="auto"
                    placeholder={a.reasonPlaceholder}
                    aria-label={a.reason}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  />
                )}
              </ActionForm>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

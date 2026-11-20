import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName, pickName } from "@/i18n/localized";
import { DAYS, formatTime } from "@/lib/timetable";
import type { TimetableRow } from "@/lib/data/timetable";
import { deleteTimetableEntry } from "@/app/[lang]/(espace)/emplois-du-temps/actions";
import { ActionForm } from "./action-form";

/**
 * Emploi du temps de la semaine : une colonne par jour sur grand écran,
 * une carte par jour sur téléphone.
 */
export function WeekTimetable({
  entries,
  dict,
  lang,
  show,
  canDelete = false,
}: {
  entries: TimetableRow[];
  dict: Dictionary;
  lang: Locale;
  /** Ce qu'on affiche sous la matière : l'enseignant (vue classe) ou la classe (vue enseignant). */
  show: "teacher" | "class";
  canDelete?: boolean;
}) {
  const tt = dict.timetable;
  const days = DAYS.filter((d) => d <= 5 || entries.some((e) => e.dayOfWeek === d)); // samedi seulement s'il est utilisé
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:grid-cols-6">
      {days.map((day) => {
        const list = entries.filter((e) => e.dayOfWeek === day);
        return (
          <section key={day} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <h3 className="mb-2 font-semibold text-blue-800">{tt.days[String(day) as keyof typeof tt.days]}</h3>
            {list.length === 0 ? (
              <p className="text-sm text-slate-400">{tt.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((e) => (
                  <li key={e.id} className="rounded-lg border-s-4 border-blue-600 bg-slate-50 px-2.5 py-2 text-sm">
                    <p className="text-xs font-medium text-slate-500" dir="ltr">
                      {formatTime(e.startMinute)} – {formatTime(e.endMinute)}
                    </p>
                    <p className="font-semibold">{pickName(e.subject, lang)}</p>
                    <p className="text-xs text-slate-600">
                      {show === "teacher"
                        ? e.teacher
                          ? personName(e.teacher, lang)
                          : tt.noTeacher
                        : lang === "ar" && e.classGroup.nameAr
                          ? e.classGroup.nameAr
                          : e.classGroup.name}
                      {e.room && ` · ${e.room.name}`}
                    </p>
                    {canDelete && (
                      <ActionForm
                        action={deleteTimetableEntry.bind(null, lang, e.id)}
                        labels={formLabels(dict, tt.remove)}
                        variant="danger"
                        confirm={`${tt.remove} ?`}
                        className="mt-1 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

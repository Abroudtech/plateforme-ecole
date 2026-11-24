import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LIFE_SKILLS, type JournalRow } from "@/lib/journal";
import { formatTime } from "@/lib/timetable";

export type SheetData = {
  date: Date;
  startMinute: number | null;
  endMinute: number | null;
  week: string | null;
  unit: string | null;
  unitDay: string | null;
  lifeSkills: string[];
  rows: JournalRow[];
  teacherName: string;
  className: string;
};

/** Regroupe les lignes consécutives qui ont le même domaine (une seule case, comme sur le cahier). */
function fieldSpans(rows: JournalRow[]) {
  const spans: number[] = rows.map(() => 0);
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].field === rows[i].field) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
}

/**
 * Une page du journal, au format du cahier papier : en-tête de la journée,
 * puis une ligne par activité et la colonne des compétences de vie.
 */
export function JournalSheet({ data, lang, L, schoolName }: { data: SheetData; lang: Locale; L: Dictionary["journal"]; schoolName: string }) {
  const rows = data.rows.length ? data.rows : [{ field: "", activity: "", duration: null, competence: "", objective: "", content: "", goal: "" } as JournalRow];
  const spans = fieldSpans(rows);
  const day = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(data.date);
  const checked = new Set(data.lifeSkills);
  const cell = "border border-slate-400 px-2 py-1.5 align-top";
  const head = "border border-slate-400 bg-slate-100 px-2 py-1.5 text-center font-bold text-blue-900 print:bg-slate-100";

  return (
    <article dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="journal-sheet rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:ring-0 sm:p-5">
      <header className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3 print:grid-cols-3">
        <div className="rounded-lg border border-slate-400 px-3 py-2">
          <p><span className="font-semibold">{L.week} :</span> {data.week ?? "……"}</p>
          <p><span className="font-semibold">{L.unit} :</span> {data.unit ?? "……"}</p>
          <p><span className="font-semibold">{L.unitDay} :</span> {data.unitDay ?? "……"}</p>
        </div>
        <div className="rounded-lg border-2 border-blue-900 px-3 py-2 text-center">
          <p className="text-base font-bold capitalize text-blue-900">{day}</p>
          <p>
            <span className="font-semibold">{L.hours} :</span>{" "}
            {data.startMinute !== null && data.endMinute !== null ? (
              <>
                {L.from} <bdi dir="ltr">{formatTime(data.startMinute)}</bdi> {L.to} <bdi dir="ltr">{formatTime(data.endMinute)}</bdi>
              </>
            ) : (
              "……"
            )}
          </p>
        </div>
        <div className="rounded-lg border border-slate-400 px-3 py-2">
          <p className="font-semibold">{schoolName}</p>
          <p><span className="font-semibold">{L.class} :</span> {data.className}</p>
          <p><span className="font-semibold">{L.teacher} :</span> {data.teacherName}</p>
        </div>
      </header>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[56rem] border-collapse text-[13px] leading-snug print:min-w-0 print:text-[11px]">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={head}>{L.field}</th>
              <th className={head}>{L.activity}</th>
              <th className={head}>{L.competence}</th>
              <th className={head}>{L.objective}</th>
              <th className={head}>{L.content}</th>
              <th className={head}>{L.goal}</th>
              <th className={head}>{L.lifeSkills}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid">
                {spans[i] > 0 && (
                  <td rowSpan={spans[i]} className={`${cell} text-center align-middle font-semibold`}>{r.field}</td>
                )}
                <td className={cell}>
                  <p className="font-semibold">{r.activity}</p>
                  {r.duration ? <p className="text-slate-600">{L.minutes.replace("{n}", String(r.duration))}</p> : null}
                </td>
                <td className={`${cell} whitespace-pre-line`}>{r.competence}</td>
                <td className={`${cell} whitespace-pre-line`}>{r.objective}</td>
                <td className={`${cell} whitespace-pre-line`}>{r.content}</td>
                <td className={`${cell} whitespace-pre-line`}>{r.goal}</td>
                {i === 0 && (
                  <td rowSpan={rows.length} className={cell}>
                    <ul className="flex flex-col gap-1">
                      {LIFE_SKILLS.map((s) => {
                        const on = checked.has(s.key);
                        return (
                          <li key={s.key} className={`flex items-center gap-1.5 ${on ? "font-semibold text-rose-800" : "text-slate-500"}`}>
                            <span aria-hidden className="shrink-0 text-base leading-none">{on ? "♥" : "♡"}</span>
                            <span>{lang === "ar" ? s.ar : s.fr}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import { Heart, Plus, X } from "lucide-react";
import { ActionForm, type FormState } from "@/components/action-form";
import type { Dictionary } from "@/i18n/dictionaries";
import { emptyRow, type JournalRow } from "@/lib/journal";

export type SubjectOption = { id: string; name: string; field: string; dir: "rtl" | "ltr" };
export type LessonOption = { id: string; term: number; title: string; field: string; competence: string; content: string };

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  labels: { submit: string; pending: string; saved?: string; errors: Record<string, string> };
  L: Dictionary["journal"];
  initial: { start: string; end: string; week: string; unit: string; unitDay: string; lifeSkills: string[]; rows: JournalRow[] };
  subjects: SubjectOption[];
  lessons: Record<string, LessonOption[]>;
  skills: { key: string; label: string }[];
};

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-sm";

/**
 * Saisie du journal sur téléphone : une carte par activité. Choisir la matière
 * remplit l'activité et le domaine ; choisir une leçon du programme remplit la
 * composante de la compétence et le contenu. Tout reste modifiable.
 */
export function JournalEditor({ action, labels, L, initial, subjects, lessons, skills }: Props) {
  const [rows, setRows] = useState<JournalRow[]>(initial.rows.length ? initial.rows : [emptyRow()]);
  const update = (i: number, patch: Partial<JournalRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <ActionForm action={action} labels={{ ...labels, submit: L.save }}>
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {L.from}
          <input name="start" type="time" defaultValue={initial.start} className={input} dir="ltr" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {L.to}
          <input name="end" type="time" defaultValue={initial.end} className={input} dir="ltr" />
        </label>
        <div className="col-span-2 grid grid-cols-3 gap-3 sm:col-span-3">
          {(["week", "unit", "unitDay"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm font-medium">
              {L[k]}
              <input name={k} defaultValue={initial[k]} maxLength={20} inputMode="numeric" className={input} />
            </label>
          ))}
        </div>
      </div>

      <h3 className="mt-1 text-base font-bold text-blue-900">{L.activities}</h3>
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const subject = subjects.find((s) => s.id === r.subjectId);
          const options = r.subjectId ? lessons[r.subjectId] ?? [] : [];
          const terms = [...new Set(options.map((o) => o.term))];
          const dir = subject?.dir;
          return (
            <li key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-900 text-xs font-bold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.activity || subject?.name || ""}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                    aria-label={L.removeRow}
                    title={L.removeRow}
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_6.5rem] gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  {L.subject}
                  <select
                    className={input}
                    value={r.subjectId ?? ""}
                    onChange={(e) => {
                      const s = subjects.find((x) => x.id === e.target.value);
                      update(i, { subjectId: s?.id ?? null, activity: s?.name ?? r.activity, field: s?.field || r.field, lessonId: null });
                    }}
                  >
                    <option value="">—</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  {L.duration}
                  <input
                    type="number"
                    min={1}
                    max={600}
                    inputMode="numeric"
                    className={input}
                    value={r.duration ?? ""}
                    onChange={(e) => update(i, { duration: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
              </div>
              {options.length > 0 && (
                <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-slate-600">
                  <span>
                    {L.lesson} <span className="font-normal text-slate-500">({L.lessonHint})</span>
                  </span>
                  <select
                    className={input}
                    value={r.lessonId ?? ""}
                    dir={dir}
                    onChange={(e) => {
                      const l = options.find((o) => o.id === e.target.value);
                      if (l) update(i, { lessonId: l.id, field: l.field, competence: l.competence, content: l.content });
                      else update(i, { lessonId: null });
                    }}
                  >
                    <option value="">{L.noLesson}</option>
                    {terms.map((t) => (
                      <optgroup key={t} label={L.termN.replace("{n}", String(t))}>
                        {options
                          .filter((o) => o.term === t)
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.title}</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["field", "activity"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    {L[k]}
                    <input className={input} dir={dir ?? "auto"} maxLength={120} value={r[k]} onChange={(e) => update(i, { [k]: e.target.value })} />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["competence", "objective", "content", "goal"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    {L[k]}
                    <textarea
                      className={input}
                      rows={2}
                      dir={dir ?? "auto"}
                      maxLength={k === "goal" ? 800 : 600}
                      value={r[k]}
                      onChange={(e) => update(i, { [k]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, emptyRow()])}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-blue-900 hover:border-gold-400"
      >
        <Plus size={16} aria-hidden /> {L.addRow}
      </button>

      <fieldset>
        <legend className="text-base font-bold text-blue-900">{L.lifeSkills}</legend>
        <p className="mb-2 text-xs text-slate-500">{L.lifeSkillsHint}</p>
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <label key={s.key} className="cursor-pointer">
              <input type="checkbox" name="skills" value={s.key} defaultChecked={initial.lifeSkills.includes(s.key)} className="peer sr-only" />
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm ring-1 ring-slate-300 peer-checked:bg-rose-50 peer-checked:font-semibold peer-checked:text-rose-800 peer-checked:ring-rose-400 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500">
                <Heart size={14} aria-hidden className="shrink-0" />
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}

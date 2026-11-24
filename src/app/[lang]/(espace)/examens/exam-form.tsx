"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ActionForm, type FormState } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";

type Option = { id: string; label: string };
type ClassOption = Option & { levelId: string; subjects: string[]; ai: boolean };
type ResourceOption = Option & { levelId: string; subjectId: string; kind: string };
const KINDS = ["CONTROL", "SYNTHESIS", "ORAL", "PRACTICAL", "OTHER"] as const;

export type ExamFormLabels = {
  form: { submit: string; pending: string; saved?: string; errors: Record<string, string> };
  steps: { when: string; revise: string; paper: string };
  class: string;
  subject: string;
  kind: string;
  kinds: Record<(typeof KINDS)[number], string>;
  date: string;
  time: string;
  duration: string;
  room: string;
  label: string;
  labelPlaceholder: string;
  revision: string;
  revisionPlaceholder: string;
  revisionHint: string;
  paper: string;
  paperHint: string;
  noPaper: string;
  makePaper: string;
  notify: string;
  optional: string;
};

export type ExamDefaults = {
  classGroupId?: string;
  subjectId?: string;
  kind?: string;
  date?: string;
  time?: string;
  duration?: number | null;
  room?: string | null;
  title?: string | null;
  revision?: string | null;
  resourceId?: string | null;
};

/**
 * « Préparer un examen » en trois blocs simples : quand et pour qui, ce qu'il
 * faut réviser, puis le sujet (choisi dans l'atelier ou à préparer avec l'IA).
 * Les matières proposées suivent la classe choisie.
 */
export function ExamForm({
  action,
  labels: l,
  classes,
  subjects,
  resources,
  defaults = {},
  editing = false,
  today,
  lang,
  aiOn,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  labels: ExamFormLabels;
  classes: ClassOption[];
  subjects: Option[];
  resources: ResourceOption[];
  defaults?: ExamDefaults;
  editing?: boolean;
  today: string;
  lang: string;
  aiOn: boolean;
}) {
  const [classId, setClassId] = useState(defaults.classGroupId ?? classes[0]?.id ?? "");
  const cls = classes.find((c) => c.id === classId);
  const shown = cls?.subjects.length ? cls.subjects.flatMap((id) => subjects.filter((s) => s.id === id)) : subjects;
  const [subjectId, setSubjectId] = useState(defaults.subjectId && shown.some((s) => s.id === defaults.subjectId) ? defaults.subjectId : shown[0]?.id ?? "");
  const currentSubject = shown.some((s) => s.id === subjectId) ? subjectId : shown[0]?.id ?? "";
  const [kind, setKind] = useState(defaults.kind ?? "CONTROL");
  const [title, setTitle] = useState(defaults.title ?? "");
  // Sujets de l'atelier du même niveau ; ceux de la matière choisie d'abord.
  const papers = resources
    .filter((r) => !cls || r.levelId === cls.levelId)
    .sort((a, b) => Number(b.subjectId === currentSubject) - Number(a.subjectId === currentSubject) || Number(b.kind === "EXAM") - Number(a.kind === "EXAM"));
  const aiHref = cls
    ? `/${lang}/atelier?type=EXAM&niveau=${cls.levelId}&matiere=${currentSubject}${title ? `&theme=${encodeURIComponent(title)}` : ""}`
    : `/${lang}/atelier`;

  const step = (n: number, text: string) => (
    <legend className="mb-3 flex items-center gap-2 font-bold text-blue-900">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-900 text-sm text-gold-300">{n}</span>
      {text}
    </legend>
  );

  return (
    <ActionForm action={action} labels={l.form}>
      <fieldset className="flex flex-col gap-4">
        {step(1, l.steps.when)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={l.class}>
            <Select name="classGroupId" value={classId} onChange={(e) => setClassId(e.target.value)} required>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={l.subject}>
            <Select name="subjectId" value={currentSubject} onChange={(e) => setSubjectId(e.target.value)} required>
              {shown.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{l.kind}</p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <label
                key={k}
                className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${kind === k ? "bg-blue-900 text-white ring-blue-900" : "bg-white ring-slate-200 hover:ring-gold-400"}`}
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {l.kinds[k]}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={l.date}>
            <Input name="date" type="date" required min={editing ? undefined : today} defaultValue={defaults.date ?? ""} />
          </Field>
          <Field label={`${l.time} (${l.optional})`}>
            <Input name="time" type="time" defaultValue={defaults.time ?? ""} />
          </Field>
          <Field label={l.duration}>
            <Input name="duration" type="number" min={5} max={300} step={5} defaultValue={defaults.duration ?? 60} />
          </Field>
          <Field label={`${l.room} (${l.optional})`}>
            <Input name="room" maxLength={60} defaultValue={defaults.room ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-slate-100 pt-4">
        {step(2, l.steps.revise)}
        <Field label={`${l.label} (${l.optional})`}>
          <Input name="title" maxLength={160} dir="auto" placeholder={l.labelPlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={l.revision} hint={l.revisionHint}>
          <Textarea name="revision" rows={3} maxLength={2000} dir="auto" placeholder={l.revisionPlaceholder} defaultValue={defaults.revision ?? ""} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        {step(3, l.steps.paper)}
        <Field label={l.paper} hint={l.paperHint}>
          <Select name="resourceId" defaultValue={defaults.resourceId ?? ""}>
            <option value="">{l.noPaper}</option>
            {papers.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
        </Field>
        {aiOn && cls?.ai && (
          <Link
            href={aiHref}
            target="_blank"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-gold-50 px-3 py-2 text-sm font-semibold text-gold-900 ring-1 ring-gold-200 hover:bg-gold-100"
          >
            <Sparkles size={16} aria-hidden /> {l.makePaper}
          </Link>
        )}
      </fieldset>

      <label className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-900">
        <input type="checkbox" name="notify" defaultChecked={!editing} className="h-4 w-4" />
        {l.notify}
      </label>
    </ActionForm>
  );
}

"use client";

import { useState } from "react";
import { ActionForm, type FormState } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";

type Option = { id: string; label: string };

export type WorkshopLabels = {
  form: {
    submit: string;
    pending: string;
    errors: Record<string, string>;
  };
  kind: string;
  kinds: Record<"LESSON" | "EXERCISES" | "EXAM", { title: string; text: string }>;
  level: string;
  subject: string;
  topic: string;
  topicHint: string;
  term: string;
  duration: string;
  count: string;
  difficulty: string;
  difficulties: Record<"easy" | "medium" | "hard", string>;
  instructions: string;
  instructionsHint: string;
  minutes: string;
  waitNote: string;
};

/**
 * Formulaire de l'atelier : type de document, niveau, matière, thème.
 * Les matières proposées suivent le programme du niveau choisi.
 */
export function WorkshopForm({
  action,
  labels: l,
  levels,
  subjects,
  subjectsByLevel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  labels: WorkshopLabels;
  levels: Option[];
  subjects: Option[];
  subjectsByLevel: Record<string, string[]>;
}) {
  const [kind, setKind] = useState<"LESSON" | "EXERCISES" | "EXAM">("LESSON");
  const [level, setLevel] = useState(levels[0]?.id ?? "");
  const allowed = subjectsByLevel[level];
  // Matières du programme du niveau, dans l'ordre des coefficients.
  const shown = allowed?.length ? allowed.flatMap((id) => subjects.filter((s) => s.id === id)) : subjects;

  return (
    <ActionForm action={action} labels={{ ...l.form }}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{l.kind}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["LESSON", "EXERCISES", "EXAM"] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-2xl p-3 ring-1 transition ${kind === k ? "bg-blue-900 text-white ring-blue-900" : "bg-white ring-slate-200 hover:ring-gold-400"}`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <span className="block font-semibold">{l.kinds[k].title}</span>
              <span className={`mt-0.5 block text-xs ${kind === k ? "text-white/75" : "text-slate-500"}`}>{l.kinds[k].text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={l.level}>
          <Select name="gradeLevelId" value={level} onChange={(e) => setLevel(e.target.value)} required>
            {levels.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label={l.subject}>
          <Select name="subjectId" key={level} required>
            {shown.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label={l.term}>
          <Select name="term" defaultValue="1">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </Select>
        </Field>
      </div>

      <Field label={l.topic} hint={l.topicHint}>
        <Input name="topic" required minLength={3} maxLength={300} dir="auto" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        {kind !== "EXERCISES" ? (
          <Field label={`${l.duration} (${l.minutes})`}>
            <Input name="duration" type="number" min={15} max={180} step={5} defaultValue={kind === "EXAM" ? 60 : 45} />
          </Field>
        ) : (
          <Field label={l.count}>
            <Input name="count" type="number" min={3} max={15} defaultValue={6} />
          </Field>
        )}
        <Field label={l.difficulty}>
          <Select name="difficulty" defaultValue="medium">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>{l.difficulties[d]}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={l.instructions} hint={l.instructionsHint}>
        <Textarea name="instructions" maxLength={1500} />
      </Field>
      <p className="text-xs text-slate-500">{l.waitNote}</p>
    </ActionForm>
  );
}

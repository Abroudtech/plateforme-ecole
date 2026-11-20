"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { ActionForm, type FormState } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui";
import type { ChallengeQuestion } from "@/lib/challenges";

type Draft = { id: number; q: string; choices: string[]; answer: number };
let nextId = 0;
const empty = (): Draft => ({ id: ++nextId, q: "", choices: ["", "", "", ""], answer: 0 });

export type ChallengeFormLabels = {
  form: { submit: string; pending: string; saved?: string; errors: Record<string, string> };
  title: string;
  subject: string;
  noSubject: string;
  closesAt: string;
  question: string;
  choice: string;
  correct: string;
  addQuestion: string;
  removeQuestion: string;
  ai: string;
  aiTopic: string;
  aiCount: string;
  aiGenerate: string;
  aiGenerating: string;
  aiReview: string;
};

/**
 * Création d'un défi : questions à choix multiples saisies à la main ou
 * proposées par l'IA (que l'enseignant relit et corrige avant d'enregistrer).
 */
export function ChallengeForm({
  action,
  suggest,
  subjects,
  aiOn,
  labels: l,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  suggest: (input: { subjectId: string; topic: string; count: number }) => Promise<{ questions: ChallengeQuestion[] } | { error: string }>;
  subjects: { id: string; label: string }[];
  aiOn: boolean;
  labels: ChallengeFormLabels;
}) {
  const [questions, setQuestions] = useState<Draft[]>([empty(), empty(), empty()]);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, start] = useTransition();
  // Change à chaque génération pour réinitialiser les champs pré-remplis.
  const [version, setVersion] = useState(0);

  const update = (i: number, patch: Partial<Draft>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const generate = () =>
    start(async () => {
      setAiError(null);
      const res = await suggest({ subjectId, topic, count });
      if ("error" in res) return setAiError(l.form.errors[res.error] ?? l.form.errors.invalid);
      setQuestions(res.questions.map((q) => ({ id: ++nextId, q: q.q, choices: [...q.choices, "", "", ""].slice(0, 4), answer: q.answer })));
      setVersion((v) => v + 1);
    });

  return (
    <div className="flex flex-col gap-4">
      {aiOn && (
        <div className="rounded-2xl bg-gold-50 p-3 ring-1 ring-gold-200">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gold-900">
            <Sparkles size={16} aria-hidden /> {l.ai}
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
            <Field label={l.subject}>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label={l.aiTopic}>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
            </Field>
            <Field label={l.aiCount}>
              <Input type="number" min={3} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20" />
            </Field>
            <button
              type="button"
              onClick={generate}
              disabled={generating || topic.trim().length < 3}
              className="rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {generating ? l.aiGenerating : l.aiGenerate}
            </button>
          </div>
          {aiError && <p role="alert" className="mt-2 text-sm text-red-700">{aiError}</p>}
          {version > 0 && !aiError && <p className="mt-2 text-xs text-gold-900">{l.aiReview}</p>}
        </div>
      )}

      <ActionForm action={action} labels={l.form} key={version}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label={l.title}>
              <Input name="title" required maxLength={120} defaultValue={version > 0 ? topic : ""} />
            </Field>
          </div>
          <Field label={l.closesAt}>
            <Input name="closesAt" type="date" />
          </Field>
        </div>
        <Field label={l.subject}>
          <Select name="subjectId" defaultValue={subjectId}>
            <option value="">{l.noSubject}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </Field>

        <ol className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-900 text-xs font-bold text-white">{i + 1}</span>
                <Input name={`q${i}`} defaultValue={q.q} placeholder={l.question} maxLength={300} onChange={(e) => update(i, { q: e.target.value })} />
                <button
                  type="button"
                  aria-label={l.removeQuestion}
                  onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, j) => (
                  <label key={j} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`a${i}`}
                      value={j}
                      defaultChecked={q.answer === j}
                      onChange={() => update(i, { answer: j })}
                      aria-label={l.correct}
                      className="size-4 shrink-0 accent-emerald-600"
                    />
                    <Input
                      name={`c${i}_${j}`}
                      defaultValue={c}
                      placeholder={`${l.choice} ${j + 1}`}
                      maxLength={120}
                      onChange={(e) => update(i, { choices: q.choices.map((x, k) => (k === j ? e.target.value : x)) })}
                    />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
        <p className="-mt-2 text-xs text-slate-500">{l.correct}</p>
        {questions.length < 20 && (
          <button
            type="button"
            onClick={() => setQuestions((qs) => [...qs, empty()])}
            className="flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-slate-400 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Plus size={16} aria-hidden /> {l.addQuestion}
          </button>
        )}
      </ActionForm>
    </div>
  );
}

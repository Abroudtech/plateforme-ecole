"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type Labels = {
  question: string;
  next: string;
  finish: string;
  sending: string;
  result: string;
  back: string;
  backHref: string;
  errors: Record<string, string>;
};

/** Défi : une question à la fois, en grands boutons ; correction à la fin. */
export function QuizPlayer({
  questions,
  submit,
  labels: l,
  done,
}: {
  questions: { prompt: string; choices: string[] }[];
  /** Défi déjà fait : on affiche directement la correction. */
  done?: { answers: (number | null)[]; score: number; correct: number[] };
  submit: (answers: (number | null)[]) => Promise<{ score: number; total: number; correct: number[] } | { error: string }>;
  labels: Labels;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => done?.answers ?? questions.map(() => null));
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number; correct: number[] } | null>(
    done ? { score: done.score, total: questions.length, correct: done.correct } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const q = questions[i];
  const last = i === questions.length - 1;

  const send = () =>
    start(async () => {
      const res = await submit(answers);
      if ("error" in res) setError(l.errors[res.error] ?? l.errors.invalid);
      else setResult(res);
    });

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-blue-900 p-6 text-center text-white">
          <p className="text-white/75">{l.result}</p>
          <p className="mt-1 text-5xl font-bold tabular-nums"><bdi dir="ltr">{result.score} / {result.total}</bdi></p>
          <p className="mt-2 text-3xl" aria-hidden>{result.score === result.total ? "🏆" : result.score >= result.total / 2 ? "🌟" : "💪"}</p>
        </div>
        <ol className="flex flex-col gap-2">
          {questions.map((qq, k) => {
            const ok = answers[k] === result.correct[k];
            return (
              <li key={k} className={`rounded-2xl p-3 text-sm ring-1 ${ok ? "bg-emerald-50 ring-emerald-200" : "bg-red-50 ring-red-200"}`}>
                <p className="font-semibold" dir="auto">{k + 1}. {qq.prompt}</p>
                {!ok && answers[k] != null && <p className="mt-1 text-red-800 line-through" dir="auto">{qq.choices[answers[k]!]}</p>}
                <p className="mt-1 text-emerald-800" dir="auto">✓ {qq.choices[result.correct[k]]}</p>
              </li>
            );
          })}
        </ol>
        <Link href={l.backHref} className="w-fit rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white">{l.back}</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-600">{l.question} {i + 1} / {questions.length}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${((i + 1) / questions.length) * 100}%` }} />
        </div>
      </div>
      <p className="rounded-3xl bg-white p-5 text-xl font-bold shadow-card ring-1 ring-slate-200/80" dir="auto">{q.prompt}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((c, j) => (
          <button
            key={j}
            type="button"
            dir="auto"
            onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
            className={`rounded-2xl p-4 text-start text-lg font-semibold ring-2 transition ${answers[i] === j ? "bg-blue-900 text-white ring-blue-900" : "bg-white ring-slate-200 hover:ring-gold-400"}`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={answers[i] == null || sending}
          onClick={() => (last ? send() : setI(i + 1))}
          className="rounded-xl bg-gold-500 px-6 py-3 font-bold text-blue-950 disabled:opacity-50"
        >
          {sending ? l.sending : last ? l.finish : l.next}
        </button>
      </div>
    </div>
  );
}

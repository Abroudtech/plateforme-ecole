"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { makeQuestions, type GameKey, type Question } from "@/lib/games";

type Labels = { start: string; again: string; score: string; counted: string; notCounted: string; back: string; backHref: string; time: string };

const SECONDS = 90;

/** Partie de 10 questions, avec réponse immédiate et un chronomètre. */
export function GamePlayer({
  game,
  level,
  save,
  labels: l,
}: {
  game: GameKey;
  level: number;
  save: (score: number) => Promise<{ counted: boolean } | { error: string }>;
  labels: Labels;
}) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [saved, setSaved] = useState<boolean | null>(null);
  const finished = questions !== null && (i >= questions.length || left <= 0);

  useEffect(() => {
    if (!questions || finished) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [questions, finished]);

  useEffect(() => {
    if (finished && saved === null) {
      save(score).then((r) => setSaved("counted" in r ? r.counted : false));
    }
  }, [finished, saved, save, score]);

  const begin = () => {
    setQuestions(makeQuestions(game, level));
    setI(0);
    setScore(0);
    setPicked(null);
    setLeft(SECONDS);
    setSaved(null);
  };

  const choose = (j: number) => {
    if (!questions || picked !== null) return;
    setPicked(j);
    if (j === questions[i].answer) setScore((s) => s + 1);
    setTimeout(() => {
      setPicked(null);
      setI((k) => k + 1);
    }, 700);
  };

  if (!questions) {
    return (
      <button type="button" onClick={begin} className="w-full rounded-3xl bg-gold-500 p-6 text-2xl font-bold text-blue-950 shadow-card">
        {l.start}
      </button>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-blue-900 p-6 text-center text-white">
        <p className="text-5xl" aria-hidden>{score >= 9 ? "🏆" : score >= 6 ? "🌟" : "💪"}</p>
        <p className="text-lg">{l.score}</p>
        <p className="text-5xl font-bold tabular-nums"><bdi dir="ltr">{score} / {questions.length}</bdi></p>
        {saved !== null && <p className="text-sm text-gold-200">{saved ? `+${score} · ${l.counted}` : l.notCounted}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={begin} className="rounded-xl bg-gold-500 px-5 py-2.5 font-bold text-blue-950">{l.again}</button>
          <Link href={l.backHref} className="rounded-xl bg-white/10 px-5 py-2.5 font-semibold">{l.back}</Link>
        </div>
      </div>
    );
  }

  const q = questions[i];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span><bdi dir="ltr">{i + 1} / {questions.length}</bdi></span>
        <span className={left <= 10 ? "text-red-700" : "text-slate-600"}>⏱ {l.time} <bdi dir="ltr">{left}s</bdi></span>
        <span>⭐ <bdi dir="ltr">{score}</bdi></span>
      </div>
      <div className="rounded-3xl bg-white p-6 text-center shadow-card ring-1 ring-slate-200/80" dir={q.dir}>
        {q.emoji && <p className="text-6xl" aria-hidden>{q.emoji}</p>}
        {q.prompt !== "?" && <p className="mt-2 text-4xl font-bold tracking-wide">{q.prompt}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3" dir={q.dir}>
        {q.choices.map((c, j) => {
          const state = picked === null ? "" : j === q.answer ? "bg-emerald-600 text-white ring-emerald-600" : j === picked ? "bg-red-600 text-white ring-red-600" : "opacity-60";
          return (
            <button
              key={j}
              type="button"
              onClick={() => choose(j)}
              className={`rounded-2xl bg-white p-5 text-2xl font-bold ring-2 ring-slate-200 transition hover:ring-gold-400 ${state}`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

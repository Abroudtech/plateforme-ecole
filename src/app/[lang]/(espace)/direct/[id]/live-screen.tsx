"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Circle, Diamond, Maximize, Square, Triangle, Users, X } from "lucide-react";
import type { LiveState } from "@/lib/data/live";
import { answerLive, joinLive, liveStep } from "../actions";

type Labels = Record<
  | "title" | "waitingTitle" | "waitingHint" | "joined" | "start" | "reveal" | "next" | "podium" | "end" | "close" | "fullscreen"
  | "questionOf" | "answeredCount" | "ranking" | "points" | "correctCount" | "youJoined" | "waitStart" | "sent" | "waitOthers"
  | "right" | "wrong" | "tooLate" | "yourRank" | "yourRankFirst" | "finished" | "yourScore" | "back" | "noPlayers",
  string
>;

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? `{${k}}`));

/** Quatre couleurs et quatre formes : on reconnaît son choix d'un coup d'œil, même sans lire. */
const CHOICES = [
  { bg: "bg-red-600", icon: Triangle },
  { bg: "bg-blue-600", icon: Diamond },
  { bg: "bg-amber-500", icon: Circle },
  { bg: "bg-emerald-600", icon: Square },
];
const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Défi en direct. L'écran se met à jour chaque seconde.
 * - Enseignant : grand écran à projeter, il fait avancer les questions.
 * - Élève : quatre grands boutons de couleur pour répondre.
 */
export function LiveScreen({ id, lang, initial, labels: l, backHref }: { id: string; lang: string; initial: LiveState; labels: Labels; backHref: string }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<{ q: number; choice: number } | null>(null);
  const autoRevealed = useRef(-1);
  const host = s.role === "host";

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/direct/${id}?lang=${lang}`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    } catch {
      // Réseau coupé un instant : on réessaie à la seconde suivante.
    }
  }, [id, lang]);

  useEffect(() => {
    if (s.phase === "DONE") return;
    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, [load, s.phase]);

  // L'élève rejoint automatiquement en ouvrant la page.
  useEffect(() => {
    if (!host && s.me && !s.me.joined && s.phase !== "DONE") void joinLive(lang, id).then(load);
  }, [host, s.me, s.phase, lang, id, load]);

  const step = (action: "start" | "reveal" | "next" | "end") => start(async () => {
    await liveStep(lang, id, action);
    await load();
  });

  // L'enseignant n'a pas besoin de cliquer : la réponse s'affiche quand le temps est écoulé ou que tout le monde a répondu.
  useEffect(() => {
    if (!host || s.phase !== "QUESTION" || autoRevealed.current === s.current) return;
    if (s.remaining === 0 || (s.players > 0 && s.answered >= s.players)) {
      autoRevealed.current = s.current;
      step("reveal");
    }
  });

  const answer = (choice: number) => {
    if (picked?.q === s.current || s.me?.choice != null) return;
    setPicked({ q: s.current, choice });
    start(async () => {
      await answerLive(lang, id, s.current, choice);
      await load();
    });
  };

  const myChoice = s.me?.choice ?? (picked?.q === s.current ? picked.choice : null);
  const btn = "rounded-2xl px-5 py-3 text-lg font-bold shadow-sm transition disabled:opacity-60";

  return (
    <div className={`flex min-h-[70vh] flex-col gap-4 rounded-3xl bg-blue-950 p-4 text-white sm:p-8 ${host ? "live-host" : ""}`} id="live-root">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">⚡ {l.title}</p>
          <h1 className="truncate text-xl font-bold sm:text-2xl" dir="auto">{s.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(s.phase === "QUESTION" || s.phase === "REVEAL") && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">{fill(l.questionOf, { n: s.current + 1, total: s.total })}</span>
          )}
          {host && (
            <button
              type="button"
              onClick={() => document.getElementById("live-root")?.requestFullscreen?.().catch(() => {})}
              className="hidden rounded-xl bg-white/10 p-2 hover:bg-white/20 sm:block"
              title={l.fullscreen}
              aria-label={l.fullscreen}
            >
              <Maximize size={18} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* --- Salle d'attente --- */}
      {s.phase === "LOBBY" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          {host ? (
            <>
              <p className="text-3xl font-bold sm:text-4xl">{l.waitingTitle}</p>
              <p className="max-w-lg text-white/70">{l.waitingHint}</p>
              <p className="flex items-center gap-2 text-2xl font-bold text-gold-300"><Users aria-hidden /> {fill(l.joined, { count: s.players })}</p>
              <ul className="flex max-w-3xl flex-wrap justify-center gap-2">
                {s.names.map((n, i) => (
                  <li key={i} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold">{n}</li>
                ))}
              </ul>
              <button type="button" onClick={() => step("start")} disabled={pending || s.total === 0} className={`${btn} bg-gold-500 px-10 py-4 text-2xl text-blue-950 hover:bg-gold-400`}>
                {l.start}
              </button>
            </>
          ) : (
            <>
              <p className="text-5xl" aria-hidden>🚀</p>
              <p className="text-2xl font-bold">{l.youJoined}</p>
              <p className="text-white/70">{l.waitStart}</p>
              <p className="text-sm text-white/60">{fill(l.joined, { count: s.players })}</p>
            </>
          )}
        </div>
      )}

      {/* --- Question --- */}
      {(s.phase === "QUESTION" || s.phase === "REVEAL") && s.question && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-start gap-4">
            <p className={`flex-1 font-bold leading-snug ${host ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"}`} dir="auto">{s.question.q}</p>
            {s.phase === "QUESTION" && (
              <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl font-bold tabular-nums ${s.remaining <= 5 ? "bg-red-600" : "bg-gold-500 text-blue-950"}`}>
                {s.remaining}
              </span>
            )}
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {s.question.choices.map((c, i) => {
              const C = CHOICES[i];
              const isAnswer = s.answer === i;
              const dim = s.phase === "REVEAL" && !isAnswer;
              const mine = myChoice === i;
              const content = (
                <>
                  <C.icon size={host ? 34 : 26} className="shrink-0 fill-white/90" aria-hidden />
                  <span className={`flex-1 text-start font-bold ${host ? "text-2xl sm:text-3xl" : "text-xl"}`} dir="auto">{c}</span>
                  {s.phase === "REVEAL" && isAnswer && <Check size={30} className="shrink-0" aria-hidden />}
                  {s.counts && <span className="shrink-0 rounded-full bg-black/20 px-3 py-1 text-lg font-bold tabular-nums">{s.counts[i]}</span>}
                </>
              );
              const cls = `flex min-h-20 items-center gap-3 rounded-2xl p-4 text-white transition ${C.bg} ${dim ? "opacity-30" : ""} ${mine ? "ring-4 ring-white" : ""}`;
              return host || s.phase !== "QUESTION" ? (
                <div key={i} className={cls}>{content}</div>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => answer(i)}
                  disabled={myChoice != null || s.remaining === 0}
                  className={`${cls} active:scale-[.98] disabled:cursor-default ${myChoice != null && !mine ? "opacity-40" : ""}`}
                >
                  {content}
                </button>
              );
            })}
          </div>

          {/* Bas d'écran : avancement (enseignant) ou retour sur sa réponse (élève). */}
          {host ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold text-white/80">{fill(l.answeredCount, { count: s.answered, total: s.players })}</p>
              {s.phase === "QUESTION" ? (
                <button type="button" onClick={() => step("reveal")} disabled={pending} className={`${btn} bg-white text-blue-950 hover:bg-gold-100`}>{l.reveal}</button>
              ) : (
                <button type="button" onClick={() => step("next")} disabled={pending} className={`${btn} bg-gold-500 text-blue-950 hover:bg-gold-400`}>
                  {s.current + 1 < s.total ? l.next : l.podium}
                </button>
              )}
            </div>
          ) : s.phase === "QUESTION" ? (
            myChoice != null ? (
              <p className="rounded-2xl bg-white/10 p-4 text-center text-lg font-semibold">✅ {l.sent} {l.waitOthers}</p>
            ) : s.remaining === 0 ? (
              <p className="rounded-2xl bg-white/10 p-4 text-center text-lg font-semibold">⏰ {l.tooLate}</p>
            ) : null
          ) : (
            <MyResult s={s} l={l} />
          )}

          {host && s.phase === "REVEAL" && s.ranking.length > 0 && <Ranking rows={s.ranking} l={l} compact />}
        </div>
      )}

      {/* --- Podium --- */}
      {s.phase === "DONE" && (
        <div className="flex flex-1 flex-col items-center gap-6">
          <p className="text-3xl font-bold">🏆 {l.finished}</p>
          {s.ranking.length === 0 ? (
            <p className="text-white/70">{l.noPlayers}</p>
          ) : (
            <>
              <div className="flex items-end justify-center gap-3" dir="ltr">
                {[1, 0, 2].map((pos) => {
                  const r = s.ranking[pos];
                  if (!r) return <div key={pos} className="w-24 sm:w-32" />;
                  const h = ["h-40", "h-28", "h-20"][pos];
                  return (
                    <div key={pos} className="flex w-24 flex-col items-center gap-2 sm:w-32">
                      <span className="text-4xl" aria-hidden>{MEDALS[r.rank - 1] ?? r.rank}</span>
                      <span className="max-w-full truncate text-center font-bold">{r.name}</span>
                      <span className="text-sm text-gold-300">{fill(l.points, { count: r.points })}</span>
                      <div className={`w-full rounded-t-xl ${h} ${pos === 0 ? "bg-gold-500" : "bg-white/20"}`} />
                    </div>
                  );
                })}
              </div>
              {s.me && (
                <div className="rounded-2xl bg-white/10 px-6 py-4 text-center">
                  <p className="text-white/70">{l.yourScore}</p>
                  <p className="text-3xl font-bold">{fill(l.points, { count: s.me.total })}</p>
                  {s.me.rank && <p className="font-semibold text-gold-300">{s.me.rank === 1 ? l.yourRankFirst : fill(l.yourRank, { rank: s.me.rank })}</p>}
                </div>
              )}
              {host && <Ranking rows={s.ranking} l={l} />}
            </>
          )}
          <Link href={backHref} className={`${btn} bg-white text-blue-950`}>{l.back}</Link>
        </div>
      )}

      {host && s.phase !== "DONE" && (
        <div className="flex justify-end">
          <button type="button" onClick={() => step("end")} disabled={pending} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            <X size={15} aria-hidden /> {l.end}
          </button>
        </div>
      )}
    </div>
  );
}

function MyResult({ s, l }: { s: LiveState; l: Labels }) {
  if (!s.me) return null;
  const ok = s.me.lastPoints != null && s.me.lastPoints > 0;
  const none = s.me.choice == null;
  return (
    <div className={`rounded-2xl p-4 text-center ${ok ? "bg-emerald-600" : "bg-red-600/80"}`}>
      <p className="text-2xl font-bold">{none ? `⏰ ${l.tooLate}` : ok ? `🎉 ${l.right} +${s.me.lastPoints}` : `😕 ${l.wrong}`}</p>
      <p className="mt-1 font-semibold text-white/90">
        {fill(l.points, { count: s.me.total })}
        {s.me.rank ? ` · ${s.me.rank === 1 ? l.yourRankFirst : fill(l.yourRank, { rank: s.me.rank })}` : ""}
      </p>
    </div>
  );
}

function Ranking({ rows, l, compact = false }: { rows: LiveState["ranking"]; l: Labels; compact?: boolean }) {
  return (
    <div className="w-full max-w-xl self-center rounded-2xl bg-white/10 p-4">
      <p className="mb-2 font-bold text-gold-300">{l.ranking}</p>
      <ol className="flex flex-col gap-1.5">
        {rows.slice(0, compact ? 5 : 10).map((r, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5">
            <span className="w-7 text-center font-bold">{MEDALS[r.rank - 1] ?? r.rank}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
            <span className="tabular-nums text-gold-300">{fill(l.points, { count: r.points })}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

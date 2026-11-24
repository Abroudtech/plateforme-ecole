/**
 * Défi en direct : calculs sans base de données (testés dans tests/live.test.ts).
 */

export type LivePhase = "LOBBY" | "QUESTION" | "REVEAL" | "DONE";

/** Marge pour les réponses envoyées à la dernière seconde (réseau lent). */
export const LIVE_GRACE_MS = 1500;
/** Choix possibles du temps de réponse, en secondes. */
export const LIVE_SECONDS = [10, 20, 30, 60] as const;

/** Points d'une réponse : 0 si faux ; sinon 500 + jusqu'à 500 selon la rapidité. */
export function livePoints(correct: boolean, ms: number, seconds: number): number {
  if (!correct) return 0;
  const ratio = Math.min(1, Math.max(0, ms / (seconds * 1000)));
  return 500 + Math.round(500 * (1 - ratio));
}

/** Secondes restantes pour la question en cours (0 si le temps est écoulé). */
export function remainingSeconds(startedAt: Date | null, seconds: number, now = Date.now()): number {
  if (!startedAt) return seconds;
  return Math.max(0, Math.ceil((startedAt.getTime() + seconds * 1000 - now) / 1000));
}

/** Vrai si une réponse arrive encore à temps. */
export function acceptsAnswer(startedAt: Date | null, seconds: number, now = Date.now()): boolean {
  return !!startedAt && now <= startedAt.getTime() + seconds * 1000 + LIVE_GRACE_MS;
}

/** Étape suivante demandée par l'enseignant ; null si elle n'a pas de sens. */
export function nextPhase(
  phase: LivePhase,
  action: "start" | "reveal" | "next" | "end",
  current: number,
  total: number,
): { phase: LivePhase; current: number } | null {
  if (action === "end") return { phase: "DONE", current };
  if (action === "start" && phase === "LOBBY") return { phase: "QUESTION", current: 0 };
  if (action === "reveal" && phase === "QUESTION") return { phase: "REVEAL", current };
  if (action === "next" && phase === "REVEAL") return current + 1 < total ? { phase: "QUESTION", current: current + 1 } : { phase: "DONE", current };
  return null;
}

/** Classement : total des points, puis bonnes réponses ; rang partagé en cas d'égalité. */
export function liveRanking<T extends { studentId: string }>(players: T[], answers: { studentId: string; points: number }[]) {
  const totals = new Map<string, { points: number; correct: number }>();
  for (const a of answers) {
    const t = totals.get(a.studentId) ?? { points: 0, correct: 0 };
    t.points += a.points;
    if (a.points > 0) t.correct += 1;
    totals.set(a.studentId, t);
  }
  const rows = players
    .map((p) => ({ ...p, points: totals.get(p.studentId)?.points ?? 0, correct: totals.get(p.studentId)?.correct ?? 0 }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.points < rows[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

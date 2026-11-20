import type { Cycle } from "@prisma/client";

/**
 * Moyenne annuelle : moyenne des trimestres pondérée.
 * Par défaut, comme dans le système tunisien au collège et au lycée :
 * (T1 + 2 × T2 + 2 × T3) / 5. Au primaire, les trois trimestres comptent pareil.
 * Chaque école peut changer ces poids et la moyenne d'admission.
 */
export const DEFAULT_ANNUAL_RULES: Record<Cycle, { termWeights: number[]; passMark: number }> = {
  PRIMARY: { termWeights: [1, 1, 1], passMark: 10 },
  MIDDLE: { termWeights: [1, 2, 2], passMark: 10 },
  SECONDARY: { termWeights: [1, 2, 2], passMark: 10 },
};

/**
 * Calcule la moyenne annuelle à partir des moyennes de chaque trimestre (dans l'ordre).
 * Un trimestre sans moyenne est ignoré ; `complete` dit si tous les trimestres sont là.
 */
export function annualAverage(termAverages: (number | null)[], weights: number[]): { average: number | null; complete: boolean } {
  let sum = 0;
  let total = 0;
  termAverages.forEach((avg, i) => {
    const w = weights[i] ?? 1;
    if (avg == null || w <= 0) return;
    sum += avg * w;
    total += w;
  });
  return {
    average: total > 0 ? sum / total : null,
    complete: termAverages.length > 0 && termAverages.every((a) => a != null),
  };
}

export type Decision = "PASS" | "FAIL" | "PENDING";

/** Proposition de décision de fin d'année (le conseil de classe tranche). */
export function proposeDecision(average: number | null, complete: boolean, passMark: number): Decision {
  if (average == null || !complete) return "PENDING";
  return Math.round(average * 100 + 1e-6) / 100 >= passMark ? "PASS" : "FAIL";
}

/** Lit des poids saisis comme "1, 2, 2" ; null si invalide. */
export function parseWeights(input: string, count: number): number[] | null {
  const parts = input.split(/[\s,;/]+/).filter(Boolean).map((x) => Number(x));
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 10) || parts.every((n) => n === 0)) return null;
  return parts;
}

/** Formule lisible : [1, 2, 2] → "(T1 + 2×T2 + 2×T3) / 5". */
export function formulaText(weights: number[]): string {
  const total = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map((w, i) => (w === 1 ? `T${i + 1}` : `${w}×T${i + 1}`)).filter((_, i) => weights[i] > 0);
  return `(${parts.join(" + ")}) / ${total}`;
}

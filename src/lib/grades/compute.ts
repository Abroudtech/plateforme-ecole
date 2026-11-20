/**
 * Calcul des moyennes et du rang (règles tunisiennes habituelles).
 *
 * - Chaque note est ramenée sur 20 (une note de 8/10 vaut 16/20).
 * - Moyenne d'une matière = moyenne des notes sur 20, pondérée par le poids
 *   de chaque évaluation. Un élève absent n'est pas compté pour cette évaluation.
 * - Moyenne générale = moyenne des matières pondérée par leur coefficient,
 *   en ne comptant que les matières où l'élève a au moins une note.
 * - Rang : les ex aequo partagent le même rang (1, 2, 2, 4...).
 *
 * Ce fichier ne dépend ni de la base ni de l'interface : il est testé à part.
 */

export type ScoreInput = { score: number | null; absent: boolean; maxScore: number; weight: number };

/** Arrondi à 2 décimales (affichage des bulletins). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function subjectAverage(scores: ScoreInput[]): number | null {
  let total = 0;
  let weights = 0;
  for (const s of scores) {
    if (s.absent || s.score === null || s.maxScore <= 0 || s.weight <= 0) continue;
    total += (s.score / s.maxScore) * 20 * s.weight;
    weights += s.weight;
  }
  return weights > 0 ? total / weights : null;
}

export function generalAverage(subjects: { average: number | null; coefficient: number }[]): number | null {
  let total = 0;
  let coefs = 0;
  for (const s of subjects) {
    if (s.average === null || s.coefficient <= 0) continue;
    total += s.average * s.coefficient;
    coefs += s.coefficient;
  }
  return coefs > 0 ? total / coefs : null;
}

/** Rang de chaque élève (null si pas de moyenne). Comparaison sur la valeur arrondie. */
export function ranks(averages: Map<string, number | null>): Map<string, number | null> {
  const sorted = [...averages.entries()]
    .filter((e): e is [string, number] => e[1] !== null)
    .map(([id, avg]) => [id, round2(avg)] as const)
    .sort((a, b) => b[1] - a[1]);
  const out = new Map<string, number | null>();
  sorted.forEach(([id, avg], i) => {
    const rank = i > 0 && sorted[i - 1][1] === avg ? out.get(sorted[i - 1][0])! : i + 1;
    out.set(id, rank);
  });
  for (const id of averages.keys()) if (!out.has(id)) out.set(id, null);
  return out;
}

/** Statistiques d'une liste de moyennes (moyenne de classe, plus haute, plus basse). */
export function stats(values: (number | null)[]) {
  const v = values.filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  return {
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    max: Math.max(...v),
    min: Math.min(...v),
  };
}

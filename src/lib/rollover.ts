/**
 * Passage à l'année suivante : règles simples et testées (sans base de données).
 */

export type NextClass = { id: string; name: string; rank: number; trackId: string | null };
export type Destination = string | "LEAVE" | null;

/** « 2026-2027 » → « 2027-2028 ». */
export function nextYearLabel(label: string): string {
  const m = label.match(/^(\d{4})\D+(\d{4})$/);
  if (!m) return label;
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
}

/** Décale une date d'un an (même jour, même mois). */
export function plusOneYear(d: Date): Date {
  const x = new Date(d);
  x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x;
}

/** Partie « section » d'un nom de classe : « 6A » → « A », « 9B1 » → « B1 ». */
export function sectionOf(name: string): string {
  return name.replace(/^\d+\s*/, "").trim().toUpperCase();
}

/**
 * Classe proposée l'an prochain pour un élève :
 * - admis : niveau suivant (même filière, même section si possible) ; dernier niveau de l'école → quitte l'école ;
 * - non admis : même classe (reconduite), sinon une classe du même niveau ;
 * - décision en attente : à choisir.
 */
export function proposeDestination(
  from: { name: string; rank: number; trackId: string | null },
  decision: "PASS" | "FAIL" | "PENDING",
  next: NextClass[],
  maxRank: number,
): Destination {
  if (decision === "PENDING") return null;
  const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  if (decision === "FAIL") {
    return (sorted.find((c) => c.name === from.name) ?? sorted.find((c) => c.rank === from.rank))?.id ?? null;
  }
  if (from.rank >= maxRank) return "LEAVE";
  const candidates = sorted.filter((c) => c.rank === from.rank + 1);
  if (candidates.length === 0) return null;
  const sameTrack = from.trackId ? candidates.filter((c) => c.trackId === from.trackId) : [];
  const pool = sameTrack.length ? sameTrack : candidates;
  return (pool.find((c) => sectionOf(c.name) === sectionOf(from.name)) ?? pool[0]).id;
}

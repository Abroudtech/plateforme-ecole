/**
 * Heures de cours d'un mois, d'après l'emploi du temps de la semaine type :
 * chaque créneau compte autant de fois que son jour revient dans le mois.
 * (Les vacances et absences ne sont pas déduites : le comptable ajuste.)
 */

/** Nombre de lundis, mardis... dans le mois (clé 1 = lundi ... 7 = dimanche). */
export function weekdayCounts(year: number, month: number): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) {
    const dow = ((new Date(Date.UTC(year, month - 1, d)).getUTCDay() + 6) % 7) + 1;
    counts[dow] += 1;
  }
  return counts;
}

/** Minutes par semaine et par mois pour une liste de créneaux. */
export function teachingMinutes(entries: { dayOfWeek: number; startMinute: number; endMinute: number }[], counts: Record<number, number>) {
  let week = 0;
  let month = 0;
  for (const e of entries) {
    const len = Math.max(0, e.endMinute - e.startMinute);
    week += len;
    month += len * (counts[e.dayOfWeek] ?? 0);
  }
  return { week, month };
}

/** "2026-11" → { year: 2026, month: 11 } (ou null si invalide). */
export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

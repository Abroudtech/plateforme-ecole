/**
 * Calendrier de l'école : examens, dates de l'école et devoirs, regroupés par semaine.
 * Fonctions sans base de données (testées dans tests/calendar.test.ts).
 */

export type AgendaKind = "exam" | "event" | "homework";

export type AgendaItem = {
  key: string;
  kind: AgendaKind;
  /** Jour (AAAA-MM-JJ). */
  date: string;
  /** Dernier jour pour une date sur plusieurs jours (vacances). */
  endDate?: string | null;
  title: string;
  detail?: string | null;
  /** Classe ou enfant concerné, affiché en étiquette. */
  tag?: string | null;
  href?: string | null;
  /** Variante (type d'examen ou d'événement) pour la couleur. */
  variant?: string;
  time?: string | null;
};

/** Lundi (AAAA-MM-JJ) de la semaine d'un jour. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Ajoute des jours à une date AAAA-MM-JJ. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Regroupe les éléments par semaine puis par jour, dans l'ordre chronologique.
 * Une date sur plusieurs jours (vacances) apparaît le jour où elle commence,
 * ou le premier jour affiché si elle a commencé avant `from`.
 */
export function groupAgenda(items: AgendaItem[], from: string) {
  const order: Record<AgendaKind, number> = { event: 0, exam: 1, homework: 2 };
  const placed = items
    .map((it) => ({ ...it, day: it.date < from && (it.endDate ?? it.date) >= from ? from : it.date }))
    .filter((it) => it.day >= from)
    .sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind] || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
  const weeks: { monday: string; days: { date: string; items: AgendaItem[] }[] }[] = [];
  for (const it of placed) {
    const monday = mondayOf(it.day);
    let week = weeks.at(-1);
    if (!week || week.monday !== monday) weeks.push((week = { monday, days: [] }));
    let day = week.days.at(-1);
    if (!day || day.date !== it.day) week.days.push((day = { date: it.day, items: [] }));
    const { day: _d, ...rest } = it;
    day.items.push(rest);
  }
  return weeks;
}

/**
 * Jours où une même classe a plusieurs examens : clé « classe|jour » → nombre.
 * Sert à prévenir l'enseignant avant de charger une journée.
 */
export function busyDays(exams: { classGroupId: string; date: string }[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const e of exams) {
    const k = `${e.classGroupId}|${e.date}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return new Map([...count].filter(([, n]) => n > 1));
}

/** Trimestre qui contient la date ; sinon le dernier commencé ; sinon le premier. */
export function termForDate<T extends { order: number; startDate: Date | null; endDate: Date | null }>(terms: T[], iso: string): T | null {
  const sorted = [...terms].sort((a, b) => a.order - b.order);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const inside = sorted.find((t) => (day(t.startDate) ?? "0000") <= iso && iso <= (day(t.endDate) ?? "9999"));
  if (inside) return inside;
  const started = sorted.filter((t) => (day(t.startDate) ?? "9999") <= iso).at(-1);
  return started ?? sorted[0] ?? null;
}

/** Résumé des notes d'un examen (sur 20) : moyenne, plus haute, plus basse, sous la moyenne. */
export function examStats(scores: (number | null)[], maxScore = 20) {
  const on20 = scores.filter((s): s is number => s != null).map((s) => (s * 20) / maxScore);
  if (on20.length === 0) return null;
  const mean = on20.reduce((a, b) => a + b, 0) / on20.length;
  return {
    count: on20.length,
    mean: Math.round(mean * 100) / 100,
    max: Math.max(...on20),
    min: Math.min(...on20),
    below: on20.filter((s) => s < 10).length,
    /** Répartition : [0-5[, [5-10[, [10-15[, [15-20]. */
    buckets: [0, 5, 10, 15].map((lo) => on20.filter((s) => s >= lo && (lo === 15 ? s <= 20 : s < lo + 5)).length),
  };
}

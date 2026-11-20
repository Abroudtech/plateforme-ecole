/** Fuseau horaire de référence des écoles (Tunisie). */
export const SCHOOL_TIME_ZONE = "Africa/Tunis";

/** Date du jour au format AAAA-MM-JJ, à l'heure de Tunis. */
export function todayISO(now = new Date(), timeZone = SCHOOL_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Lit une date "AAAA-MM-JJ" ; renvoie null si invalide. */
export function parseISODate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Matin avant 12h30 (heure de Tunis), après-midi ensuite. */
export function currentPeriod(now = new Date(), timeZone = SCHOOL_TIME_ZONE): "MORNING" | "AFTERNOON" {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(now)
    .split(":")
    .map(Number);
  return h * 60 + m < 12 * 60 + 30 ? "MORNING" : "AFTERNOON";
}

/**
 * Outils pour l'emploi du temps : heures, chevauchements et conflits.
 * Les heures sont stockées en minutes depuis minuit (8h30 = 510).
 */

export const DAYS = [1, 2, 3, 4, 5, 6] as const; // lundi → samedi

/** "08:30" ou "8h30" → 510 ; null si invalide. */
export function parseTime(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 → "08:30". */
export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type Slot = { dayOfWeek: number; startMinute: number; endMinute: number };

/** Deux cours se chevauchent s'ils sont le même jour et que leurs horaires se croisent. */
export function overlaps(a: Slot, b: Slot): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export type Conflict = "class" | "teacher" | "room";

/**
 * Cherche les conflits d'un nouveau cours avec les cours existants de l'école :
 * même classe, même enseignant ou même salle au même moment.
 */
export function findConflicts<T extends Slot & { id: string; classGroupId: string; teacherId: string | null; roomId: string | null }>(
  entry: Slot & { id?: string; classGroupId: string; teacherId: string | null; roomId: string | null },
  existing: T[],
): { kind: Conflict; with: T }[] {
  const out: { kind: Conflict; with: T }[] = [];
  for (const e of existing) {
    if (e.id === entry.id || !overlaps(entry, e)) continue;
    if (e.classGroupId === entry.classGroupId) out.push({ kind: "class", with: e });
    else if (entry.teacherId && e.teacherId === entry.teacherId) out.push({ kind: "teacher", with: e });
    else if (entry.roomId && e.roomId === entry.roomId) out.push({ kind: "room", with: e });
  }
  return out;
}

/** Durée lisible : 3.75 → "3 h 45", 4 → "4 h" (gabarits fournis par le dictionnaire). */
export function formatDuration(hours: number, templates: { duration: string; durationHours: string }): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const fill = (tpl: string) => tpl.replace("{h}", String(h)).replace("{m}", String(m).padStart(2, "0"));
  return m === 0 ? fill(templates.durationHours) : fill(templates.duration);
}

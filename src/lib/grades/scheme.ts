import type { AssessmentKind, PrismaClient } from "@prisma/client";

export type SchemeItem = { kind: AssessmentKind; weight: number };
export type SchemeSource = "classSubject" | "class" | "levelSubject" | "level" | "school" | "default";

/** Structure par défaut : oral ×1, contrôle ×1, synthèse ×2. */
export const DEFAULT_SCHEME: SchemeItem[] = [
  { kind: "ORAL", weight: 1 },
  { kind: "CONTROL", weight: 1 },
  { kind: "SYNTHESIS", weight: 2 },
];

/** Ordre d'affichage des types de notes. */
export const KIND_ORDER: AssessmentKind[] = ["ORAL", "CONTROL", "SYNTHESIS", "PRACTICAL", "OTHER"];

type SchemeRow = {
  id: string;
  gradeLevelId: string | null;
  trackId: string | null;
  classGroupId: string | null;
  subjectId: string | null;
  items: { kind: AssessmentKind; weight: unknown }[];
};

/**
 * Charge toutes les structures qui peuvent concerner une classe, et renvoie
 * une fonction qui donne la structure applicable à une matière (la plus précise).
 */
export async function loadSchemeResolver(
  db: PrismaClient,
  schoolId: string,
  cls: { id: string; gradeLevelId: string; trackId: string | null },
) {
  const rows: SchemeRow[] = await db.evaluationScheme.findMany({
    where: {
      schoolId,
      OR: [
        { classGroupId: cls.id },
        { classGroupId: null, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId },
        { classGroupId: null, gradeLevelId: null, trackId: null, subjectId: null },
      ],
    },
    include: { items: true },
  });
  return (subjectId: string) => resolveScheme(rows, cls, subjectId);
}

export function resolveScheme(
  rows: SchemeRow[],
  cls: { id: string; gradeLevelId: string; trackId: string | null },
  subjectId: string,
): { items: SchemeItem[]; source: SchemeSource; schemeId: string | null } {
  const candidates: [SchemeSource, (r: SchemeRow) => boolean][] = [
    ["classSubject", (r) => r.classGroupId === cls.id && r.subjectId === subjectId],
    ["class", (r) => r.classGroupId === cls.id && r.subjectId === null],
    ["levelSubject", (r) => !r.classGroupId && r.gradeLevelId === cls.gradeLevelId && r.trackId === cls.trackId && r.subjectId === subjectId],
    ["level", (r) => !r.classGroupId && r.gradeLevelId === cls.gradeLevelId && r.trackId === cls.trackId && r.subjectId === null],
    ["school", (r) => !r.classGroupId && !r.gradeLevelId && !r.trackId && !r.subjectId],
  ];
  for (const [source, match] of candidates) {
    const row = rows.find(match);
    if (row && row.items.length > 0) {
      const items = row.items
        .map((i) => ({ kind: i.kind, weight: Number(i.weight) }))
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
      return { items, source, schemeId: row.id };
    }
  }
  return { items: DEFAULT_SCHEME, source: "default", schemeId: null };
}

export function kindWeights(items: SchemeItem[]): Record<string, number> {
  return Object.fromEntries(items.map((i) => [i.kind, i.weight]));
}

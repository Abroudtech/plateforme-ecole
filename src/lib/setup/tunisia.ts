import type { Cycle } from "@prisma/client";

/**
 * Référentiel du système scolaire tunisien, utilisé pour préparer
 * automatiquement une nouvelle école (niveaux, filières, matières).
 * Chaque école peut ensuite l'adapter.
 */

export const GRADE_LEVELS: { code: string; cycle: Cycle; rank: number; nameFr: string; nameAr: string }[] = [
  { code: "PREP", cycle: "PRIMARY", rank: 0, nameFr: "Année préparatoire", nameAr: "السنة التحضيرية" },
  { code: "P1", cycle: "PRIMARY", rank: 1, nameFr: "1re année", nameAr: "السنة الأولى" },
  { code: "P2", cycle: "PRIMARY", rank: 2, nameFr: "2e année", nameAr: "السنة الثانية" },
  { code: "P3", cycle: "PRIMARY", rank: 3, nameFr: "3e année", nameAr: "السنة الثالثة" },
  { code: "P4", cycle: "PRIMARY", rank: 4, nameFr: "4e année", nameAr: "السنة الرابعة" },
  { code: "P5", cycle: "PRIMARY", rank: 5, nameFr: "5e année", nameAr: "السنة الخامسة" },
  { code: "P6", cycle: "PRIMARY", rank: 6, nameFr: "6e année", nameAr: "السنة السادسة" },
  { code: "C7", cycle: "MIDDLE", rank: 7, nameFr: "7e année de base", nameAr: "السنة السابعة أساسي" },
  { code: "C8", cycle: "MIDDLE", rank: 8, nameFr: "8e année de base", nameAr: "السنة الثامنة أساسي" },
  { code: "C9", cycle: "MIDDLE", rank: 9, nameFr: "9e année de base", nameAr: "السنة التاسعة أساسي" },
  { code: "S1", cycle: "SECONDARY", rank: 10, nameFr: "1re année secondaire", nameAr: "السنة الأولى ثانوي" },
  { code: "S2", cycle: "SECONDARY", rank: 11, nameFr: "2e année secondaire", nameAr: "السنة الثانية ثانوي" },
  { code: "S3", cycle: "SECONDARY", rank: 12, nameFr: "3e année secondaire", nameAr: "السنة الثالثة ثانوي" },
  { code: "S4", cycle: "SECONDARY", rank: 13, nameFr: "4e année secondaire (Bac)", nameAr: "السنة الرابعة ثانوي (باكالوريا)" },
];

/** Filières du lycée (à partir de la 2e année secondaire). */
export const TRACKS: { code: string; nameFr: string; nameAr: string }[] = [
  { code: "SCI", nameFr: "Sciences", nameAr: "علوم" },
  { code: "LET", nameFr: "Lettres", nameAr: "آداب" },
  { code: "ECOSERV", nameFr: "Économie et services", nameAr: "اقتصاد وخدمات" },
  { code: "TI", nameFr: "Technologies de l'informatique", nameAr: "تكنولوجيات الإعلامية" },
  { code: "MATH", nameFr: "Mathématiques", nameAr: "رياضيات" },
  { code: "SEXP", nameFr: "Sciences expérimentales", nameAr: "علوم تجريبية" },
  { code: "STECH", nameFr: "Sciences techniques", nameAr: "علوم تقنية" },
  { code: "SINFO", nameFr: "Sciences de l'informatique", nameAr: "علوم الإعلامية" },
  { code: "ECOGEST", nameFr: "Économie et gestion", nameAr: "اقتصاد وتصرّف" },
  { code: "SPORT", nameFr: "Sport", nameAr: "رياضة" },
];

export const SUBJECTS: { code: string; nameFr: string; nameAr: string }[] = [
  { code: "AR", nameFr: "Arabe", nameAr: "العربية" },
  { code: "FR", nameFr: "Français", nameAr: "الفرنسية" },
  { code: "EN", nameFr: "Anglais", nameAr: "الإنجليزية" },
  { code: "MATH", nameFr: "Mathématiques", nameAr: "الرياضيات" },
  { code: "EVEIL", nameFr: "Éveil scientifique", nameAr: "الإيقاظ العلمي" },
  { code: "SVT", nameFr: "Sciences de la vie et de la terre", nameAr: "علوم الحياة والأرض" },
  { code: "PHYS", nameFr: "Sciences physiques", nameAr: "العلوم الفيزيائية" },
  { code: "TECH", nameFr: "Technologie", nameAr: "التربية التكنولوجية" },
  { code: "INFO", nameFr: "Informatique", nameAr: "الإعلامية" },
  { code: "ISL", nameFr: "Éducation islamique", nameAr: "التربية الإسلامية" },
  { code: "HG", nameFr: "Histoire-Géographie", nameAr: "التاريخ والجغرافيا" },
  { code: "CIV", nameFr: "Éducation civique", nameAr: "التربية المدنية" },
  { code: "PHILO", nameFr: "Philosophie", nameAr: "الفلسفة" },
  { code: "ART", nameFr: "Éducation artistique", nameAr: "التربية الفنية" },
  { code: "EPS", nameFr: "Éducation physique", nameAr: "التربية البدنية" },
];

/** Les trois trimestres de l'année scolaire. */
export const TRIMESTERS: { order: number; nameFr: string; nameAr: string }[] = [
  { order: 1, nameFr: "1er trimestre", nameAr: "الثلاثي الأول" },
  { order: 2, nameFr: "2e trimestre", nameAr: "الثلاثي الثاني" },
  { order: 3, nameFr: "3e trimestre", nameAr: "الثلاثي الثالث" },
];

/**
 * Programme par défaut (matières et coefficients), proposé pour démarrer.
 * Ce sont des valeurs indicatives : chaque école les ajuste sur la page
 * "Matières et coefficients" d'une classe.
 */
const PRIMARY_LOWER = { AR: 2, FR: 2, MATH: 2, EVEIL: 1, ISL: 1, ART: 1, EPS: 1 };
const PRIMARY_UPPER = { ...PRIMARY_LOWER, EN: 1, HG: 1, CIV: 1 };
const MIDDLE = { AR: 2, FR: 2, EN: 1.5, MATH: 2, SVT: 1.5, PHYS: 1.5, TECH: 1, INFO: 1, ISL: 1, HG: 1.5, CIV: 1, ART: 1, EPS: 1 };
const SECONDARY = { AR: 2, FR: 2, EN: 1.5, MATH: 3, PHYS: 2, SVT: 1.5, TECH: 1.5, INFO: 1, ISL: 1, HG: 1.5, CIV: 1, EPS: 1 };
const BAC_BY_TRACK: Record<string, Record<string, number>> = {
  MATH: { MATH: 4, PHYS: 4, SVT: 1, INFO: 1, AR: 1, FR: 1, EN: 1, PHILO: 1, EPS: 1 },
  SEXP: { SVT: 4, PHYS: 4, MATH: 3, INFO: 1, AR: 1, FR: 1, EN: 1, PHILO: 1, EPS: 1 },
  STECH: { TECH: 4, MATH: 3, PHYS: 3, INFO: 1, AR: 1, FR: 1, EN: 1, PHILO: 1, EPS: 1 },
  SINFO: { INFO: 4, MATH: 3, PHYS: 2, AR: 1, FR: 1, EN: 1, PHILO: 1, EPS: 1 },
  ECOGEST: { MATH: 2, HG: 2, AR: 1, FR: 1, EN: 1, PHILO: 1, INFO: 1, EPS: 1 },
  LET: { AR: 4, PHILO: 3, FR: 2, EN: 2, HG: 2, ISL: 1, INFO: 1, EPS: 1 },
};

export function defaultCurriculum(levelCode: string, trackCode: string | null): Record<string, number> {
  if (["PREP", "P1", "P2", "P3"].includes(levelCode)) return PRIMARY_LOWER;
  if (levelCode.startsWith("P")) return PRIMARY_UPPER;
  if (levelCode.startsWith("C")) return MIDDLE;
  if ((levelCode === "S3" || levelCode === "S4") && trackCode && BAC_BY_TRACK[trackCode]) return BAC_BY_TRACK[trackCode];
  return SECONDARY;
}

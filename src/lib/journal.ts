import { z } from "zod";
import type { Lesson, ProgrammeSubject } from "@/lib/curriculum";

/**
 * Journal de classe (« كرّاس القسم » / journal de l'enseignant) : la préparation
 * de la journée, activité par activité, comme sur le cahier papier du primaire.
 * Ce fichier ne lit pas la base : il est testé (tests/journal.test.ts).
 */

/** Compétences de vie (المهارات الحياتية), cochées pour la journée, dans l'ordre du cahier papier. */
export const LIFE_SKILLS = [
  { key: "creativity", ar: "الابتكار والإبداع", fr: "Créativité et innovation" },
  { key: "criticalThinking", ar: "الفكر النقدي", fr: "Pensée critique" },
  { key: "problemSolving", ar: "حل المشكلات", fr: "Résolution de problèmes" },
  { key: "collaboration", ar: "العمل التشاركي", fr: "Travail collaboratif" },
  { key: "negotiation", ar: "التفاوض", fr: "Négociation" },
  { key: "decisionMaking", ar: "اتخاذ القرارات", fr: "Prise de décision" },
  { key: "selfManagement", ar: "التدبير الذاتي", fr: "Autonomie (gestion de soi)" },
  { key: "stressManagement", ar: "التحكم في الضغوطات", fr: "Gestion du stress" },
  { key: "communication", ar: "التواصل", fr: "Communication" },
  { key: "respect", ar: "احترام الاختلاف", fr: "Respect de la différence" },
  { key: "empathy", ar: "القدرة على فهم مشاعر الآخر والتفاعل معه", fr: "Comprendre les autres (empathie)" },
  { key: "participation", ar: "المساهمة في الأنشطة الاجتماعية", fr: "Participation à la vie sociale" },
] as const;

export type LifeSkill = (typeof LIFE_SKILLS)[number]["key"];
const SKILL_KEYS = new Set<string>(LIFE_SKILLS.map((s) => s.key));

/** Ne garde que les compétences connues, sans doublon, dans l'ordre du cahier. */
export function cleanSkills(values: readonly string[]): LifeSkill[] {
  const wanted = new Set(values.filter((v) => SKILL_KEYS.has(v)));
  return LIFE_SKILLS.map((s) => s.key).filter((k) => wanted.has(k));
}

/** Une activité de la journée (une ligne du cahier). */
export type JournalRow = {
  subjectId: string | null;
  /** المجال : domaine d'apprentissage (langue arabe, sciences et technologie...). */
  field: string;
  /** النشاط : l'activité (lecture, calcul, éducation islamique...). */
  activity: string;
  /** Durée en minutes. */
  duration: number | null;
  /** مكون الكفاية */
  competence: string;
  /** الهدف المميز */
  objective: string;
  /** المحتوى */
  content: string;
  /** هدف الحصة */
  goal: string;
  /** Leçon du programme officiel d'où viennent les champs (facultatif). */
  lessonId: string | null;
};

const text = (max: number) => z.string().trim().max(max).catch("");
const rowSchema = z.object({
  subjectId: z.string().max(40).nullable().catch(null),
  field: text(120),
  activity: text(120),
  duration: z.coerce.number().int().min(1).max(600).nullable().catch(null),
  competence: text(600),
  objective: text(600),
  content: text(600),
  goal: text(800),
  lessonId: z.string().max(40).nullable().catch(null),
});

export function emptyRow(): JournalRow {
  return { subjectId: null, field: "", activity: "", duration: null, competence: "", objective: "", content: "", goal: "", lessonId: null };
}

/** Lit les activités enregistrées (ou envoyées par le formulaire) ; les lignes vides sont retirées. */
export function parseRows(value: unknown): JournalRow[] {
  const list = Array.isArray(value) ? value.slice(0, 20) : [];
  return list
    .map((r) => rowSchema.safeParse({ ...emptyRow(), ...(typeof r === "object" && r ? r : {}) }))
    .filter((r) => r.success)
    .map((r) => ({ ...r.data, subjectId: r.data.subjectId || null, lessonId: r.data.lessonId || null }))
    .filter((r) => [r.activity, r.field, r.competence, r.objective, r.content, r.goal].some((t) => t !== ""));
}

/**
 * Domaine d'apprentissage (المجال) d'une matière du programme du primaire :
 * langue arabe, sciences et technologie, éducation sociale, langues étrangères.
 */
export function fieldOf(subject: ProgrammeSubject | null, lang: "fr" | "ar"): string {
  if (!subject) return "";
  const fields = {
    AR: { ar: "اللغة العربية", fr: "Langue arabe" },
    MATH: { ar: "العلوم والتكنولوجيا", fr: "Sciences et technologie" },
    EVEIL: { ar: "العلوم والتكنولوجيا", fr: "Sciences et technologie" },
    ISL: { ar: "التنشئة الاجتماعية", fr: "Éducation sociale" },
    HG: { ar: "التنشئة الاجتماعية", fr: "Éducation sociale" },
    CIV: { ar: "التنشئة الاجتماعية", fr: "Éducation sociale" },
    FR: { ar: "اللغات الأجنبية", fr: "Langues étrangères" },
    EN: { ar: "اللغات الأجنبية", fr: "Langues étrangères" },
  } as const;
  return fields[subject][lang];
}

/**
 * Langue dans laquelle s'écrit l'activité : le français et l'anglais dans leur langue,
 * les autres matières du primaire tunisien en arabe.
 */
export function contentLang(subject: ProgrammeSubject | null, uiLang: "fr" | "ar"): "fr" | "ar" {
  if (subject === "FR" || subject === "EN") return "fr";
  if (subject) return "ar";
  return uiLang;
}

/** Champs remplis à partir d'une leçon du programme officiel. */
export function rowFromLesson(lesson: Lesson, lang: "fr" | "ar"): Pick<JournalRow, "field" | "competence" | "content" | "lessonId"> {
  const l = contentLang(lesson.subject, lang);
  return {
    field: fieldOf(lesson.subject, l),
    competence: lesson.domain[l],
    content: lesson[l],
    lessonId: lesson.id,
  };
}

/** Lignes proposées pour une nouvelle journée, à partir de l'emploi du temps (dans l'ordre des créneaux). */
export function rowsFromTimetable(
  entries: { subjectId: string; startMinute: number; endMinute: number; subject: { nameFr: string; nameAr: string | null }; programme: ProgrammeSubject | null }[],
  lang: "fr" | "ar",
): { rows: JournalRow[]; startMinute: number | null; endMinute: number | null } {
  const sorted = [...entries].sort((a, b) => a.startMinute - b.startMinute);
  const rows = sorted.map((e) => {
    const l = contentLang(e.programme, lang);
    return {
      ...emptyRow(),
      subjectId: e.subjectId,
      field: fieldOf(e.programme, l),
      activity: l === "ar" ? e.subject.nameAr || e.subject.nameFr : e.subject.nameFr,
      duration: e.endMinute - e.startMinute,
    };
  });
  return {
    rows,
    startMinute: sorted.length ? sorted[0].startMinute : null,
    endMinute: sorted.length ? Math.max(...sorted.map((e) => e.endMinute)) : null,
  };
}

/** Lundi de la semaine d'une date (AAAA-MM-JJ). */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Ajoute des jours à une date AAAA-MM-JJ. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Jours de classe d'une semaine (lundi à samedi). */
export function schoolWeek(monday: string): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i));
}

/** Jour de la semaine d'une date AAAA-MM-JJ : 1 = lundi ... 7 = dimanche (comme l'emploi du temps). */
export function isoWeekday(iso: string): number {
  return ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

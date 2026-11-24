import { PROGRAMME, PROGRAMME_LEVELS, PROGRAMME_SUBJECTS, type ProgrammeLevel, type ProgrammeSubject, type Term } from "./data";

export { PROGRAMME_LEVELS, PROGRAMME_SUBJECTS, type ProgrammeLevel, type ProgrammeSubject, type Term };

export type Lesson = {
  /** Identifiant stable : niveau-matière-numéro (ex. « P5-MATH-7 »). */
  id: string;
  level: ProgrammeLevel;
  subject: ProgrammeSubject;
  term: Term;
  fr: string;
  ar: string;
  domain: { fr: string; ar: string };
};

export type SubjectView = {
  level: ProgrammeLevel;
  subject: ProgrammeSubject;
  competence: { fr: string; ar: string };
  domains: { fr: string; ar: string; lessons: Lesson[] }[];
};

const isLevel = (v: string): v is ProgrammeLevel => (PROGRAMME_LEVELS as readonly string[]).includes(v);

/** Programme d'une matière pour un niveau, leçons numérotées dans l'ordre du référentiel. */
export function subjectProgramme(level: string, subject: string): SubjectView | null {
  if (!isLevel(level)) return null;
  const s = PROGRAMME_SUBJECTS.find((x) => x === subject);
  const p = s ? PROGRAMME[level][s] : undefined;
  if (!s || !p) return null;
  let n = 0;
  return {
    level,
    subject: s,
    competence: p.competence,
    domains: p.domains.map((dom) => ({
      fr: dom.fr,
      ar: dom.ar,
      lessons: dom.lessons.map(([term, fr, ar]) => ({
        id: `${level}-${s}-${++n}`,
        level,
        subject: s,
        term,
        fr,
        ar,
        domain: { fr: dom.fr, ar: dom.ar },
      })),
    })),
  };
}

/** Matières du référentiel disponibles pour un niveau. */
export function programmeSubjects(level: string): ProgrammeSubject[] {
  if (!isLevel(level)) return [];
  return PROGRAMME_SUBJECTS.filter((s) => PROGRAMME[level][s]);
}

/** Toutes les leçons d'une matière, dans l'ordre (domaine par domaine). */
export function lessonsOf(level: string, subject: string): Lesson[] {
  return subjectProgramme(level, subject)?.domains.flatMap((dm) => dm.lessons) ?? [];
}

/** Retrouve une leçon par son identifiant. */
export function findLesson(id: string): Lesson | null {
  const [level, subject] = id.split("-");
  if (!level || !subject) return null;
  return lessonsOf(level, subject).find((l) => l.id === id) ?? null;
}

/**
 * Leçon qui précède dans le même domaine (sert de prérequis probable),
 * ou null pour la première leçon du domaine.
 */
export function previousLesson(lesson: Lesson): Lesson | null {
  const view = subjectProgramme(lesson.level, lesson.subject);
  const dom = view?.domains.find((dm) => dm.lessons.some((l) => l.id === lesson.id));
  if (!dom) return null;
  const i = dom.lessons.findIndex((l) => l.id === lesson.id);
  return i > 0 ? dom.lessons[i - 1] : null;
}

/**
 * Matière du référentiel qui correspond à une matière de l'école
 * (par code, sinon par nom), pour que chaque école garde ses propres intitulés.
 */
export function programmeSubjectFor(subject: { code?: string | null; nameFr: string }): ProgrammeSubject | null {
  const code = (subject.code ?? "").toUpperCase();
  const byCode = PROGRAMME_SUBJECTS.find((s) => s === code);
  if (byCode) return byCode;
  const name = subject.nameFr.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (name.startsWith("arabe") || name.includes("langue arabe")) return "AR";
  if (name.startsWith("math")) return "MATH";
  if (name.startsWith("francais")) return "FR";
  if (name.startsWith("anglais")) return "EN";
  if (name.includes("eveil")) return "EVEIL";
  if (name.includes("islam")) return "ISL";
  if (name.includes("histoire") || name.includes("geographie")) return "HG";
  if (name.includes("civique")) return "CIV";
  return null;
}

/** Intitulé d'une leçon dans la langue de l'interface. */
export function lessonTitle(l: Pick<Lesson, "fr" | "ar">, lang: string): string {
  return lang === "ar" ? l.ar : l.fr;
}

/**
 * Sources officielles à consulter (liens, pas de copie des documents).
 * Les manuels du CNP restent la référence de l'enseignant pour l'ordre exact des leçons.
 */
export const OFFICIAL_SOURCES = [
  { key: "cnp", url: "https://www.cnp.com.tn/" },
  { key: "ministry", url: "https://www.education.gov.tn/" },
  { key: "edunet", url: "https://www.edunet.tn/" },
] as const;

/** Texte ajouté à la demande faite à l'IA quand l'enseignant part d'une leçon du référentiel. */
export function lessonContext(lesson: Lesson): string {
  const view = subjectProgramme(lesson.level, lesson.subject)!;
  const prev = previousLesson(lesson);
  return [
    "Repère du programme officiel tunisien (référentiel de l'école) :",
    `- Domaine : ${lesson.domain.fr} (${lesson.domain.ar})`,
    `- Leçon : ${lesson.fr}${lesson.ar !== lesson.fr ? ` (${lesson.ar})` : ""}, trimestre ${lesson.term}`,
    `- Compétence visée en fin d'année : ${view.competence.fr}`,
    prev ? `- Leçon précédente dans ce domaine (prérequis probable) : ${prev.fr}${prev.ar !== prev.fr ? ` (${prev.ar})` : ""}` : "",
    "Reste fidèle à ce que le programme officiel attend pour ce niveau ; n'anticipe pas les notions des années suivantes. Ne recopie aucun texte de manuel : rédige des contenus originaux.",
  ]
    .filter(Boolean)
    .join("\n");
}

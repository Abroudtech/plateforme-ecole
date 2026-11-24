import "server-only";
import type { Locale } from "@/i18n/config";
import { personName } from "@/i18n/localized";
import { lessonsOf, programmeSubjectFor } from "@/lib/curriculum";
import { db } from "@/lib/db";
import { getClassCurriculum } from "@/lib/data/grades";
import { contentLang, fieldOf, isoWeekday, parseRows, rowFromLesson, rowsFromTimetable } from "@/lib/journal";

type Cls = { id: string; gradeLevelId: string; trackId: string | null; gradeLevel: { code: string } };

/**
 * Matières de la classe et leçons du programme officiel pour chacune, dans la
 * langue où l'activité s'écrit (arabe, ou français/anglais pour ces matières).
 */
export async function journalOptions(schoolId: string, cls: Cls, lang: Locale) {
  const curriculum = await getClassCurriculum(schoolId, cls);
  const subjects = curriculum.map(({ subject }) => {
    const prog = programmeSubjectFor(subject);
    const l = contentLang(prog, lang);
    return {
      id: subject.id,
      name: l === "ar" ? subject.nameAr || subject.nameFr : subject.nameFr,
      field: fieldOf(prog, l),
      dir: (l === "ar" ? "rtl" : "ltr") as "rtl" | "ltr",
      prog,
    };
  });
  const lessons: Record<string, { id: string; term: number; title: string; field: string; competence: string; content: string }[]> = {};
  for (const s of subjects) {
    if (!s.prog) continue;
    const list = lessonsOf(cls.gradeLevel.code, s.prog);
    if (list.length === 0) continue;
    lessons[s.id] = list.map((l) => {
      const filled = rowFromLesson(l, lang);
      return { id: l.id, term: l.term, title: filled.content, field: filled.field, competence: filled.competence, content: filled.content };
    });
  }
  return { subjects: subjects.map(({ prog: _p, ...s }) => s), lessons, programme: new Map(subjects.map((s) => [s.id, s.prog])) };
}

/**
 * Proposition pour une journée pas encore remplie : les créneaux de l'enseignant
 * dans cette classe ce jour-là, et la semaine / l'unité de son dernier journal.
 */
export async function journalDraft(schoolId: string, classId: string, isoDate: string, teacherId: string | null, authorId: string, lang: Locale, programme: Map<string, ReturnType<typeof programmeSubjectFor>>) {
  const [entries, last] = await Promise.all([
    teacherId
      ? db.timetableEntry.findMany({
          where: { schoolId, classGroupId: classId, teacherId, dayOfWeek: isoWeekday(isoDate) },
          include: { subject: true },
        })
      : [],
    db.classJournal.findFirst({
      where: { schoolId, classGroupId: classId, authorId, date: { lt: new Date(`${isoDate}T00:00:00Z`) } },
      orderBy: { date: "desc" },
      select: { week: true, unit: true },
    }),
  ]);
  const draft = rowsFromTimetable(
    entries.map((e) => ({ ...e, programme: programme.get(e.subjectId) ?? programmeSubjectFor(e.subject) })),
    lang,
  );
  return { ...draft, week: last?.week ?? null, unit: last?.unit ?? null };
}

/** Journaux d'une classe sur une période, avec le nom de l'enseignant (pour la lecture et l'impression). */
export async function listJournals(schoolId: string, classId: string, from: Date, to: Date, authorId: string | null, lang: Locale) {
  const list = await db.classJournal.findMany({
    where: { schoolId, classGroupId: classId, date: { gte: from, lte: to }, ...(authorId ? { authorId } : {}) },
    include: { teacher: true, author: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return list.map((j) => ({
    ...j,
    rows: parseRows(j.rows),
    teacherName: j.teacher ? personName(j.teacher, lang) : `${j.author.firstName} ${j.author.lastName}`,
  }));
}

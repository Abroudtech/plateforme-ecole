import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";
import { aiEnabled } from "@/lib/ai/generate";
import { daysBetween } from "@/lib/calendar";
import type { managedClasses } from "@/lib/data/class-space";
import { toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import type { ExamFormLabels } from "./exam-form";

/** « aujourd'hui », « demain », « dans 5 jours ». */
export function whenLabel(date: Date, today: string, dict: Dictionary) {
  const n = daysBetween(today, toISODate(date));
  if (n === 0) return dict.exams.today;
  if (n === 1) return dict.exams.tomorrow;
  if (n > 1 && n <= 14) return t(dict.exams.inDays, { count: n });
  return null;
}

/** Pastille de date (jour + mois), comme une page de calendrier. */
export function DateBadge({ date, lang, tone = "blue" }: { date: Date; lang: Locale; tone?: "blue" | "gold" | "green" }) {
  const locale = lang === "ar" ? "ar-TN" : "fr-TN";
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
  const colors = { blue: "bg-blue-900 text-white", gold: "bg-gold-500 text-blue-950", green: "bg-emerald-600 text-white" }[tone];
  return (
    <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${colors}`}>
      <span className="text-lg font-bold">{day}</span>
      <span className="text-[10px] font-semibold uppercase opacity-80">{month}</span>
    </span>
  );
}

/** Données et textes du formulaire d'examen (partagés avec la page de modification). */
export async function examFormProps(
  ctx: { school: { id: string }; user: { id: string }; roles: readonly Role[] },
  classes: Awaited<ReturnType<typeof managedClasses>>,
  lang: Locale,
  dict: Dictionary,
) {
  const schoolId = ctx.school.id;
  const isAdmin = ctx.roles.includes("ADMIN");
  const levelIds = [...new Set(classes.map((c) => c.gradeLevelId))];
  const [curriculum, subjects, resources, mine] = await Promise.all([
    db.curriculumSubject.findMany({ where: { schoolId, gradeLevelId: { in: levelIds } }, select: { gradeLevelId: true, trackId: true, subjectId: true }, orderBy: { coefficient: "desc" } }),
    db.subject.findMany({ where: { schoolId }, orderBy: { nameFr: "asc" } }),
    db.teachingResource.findMany({
      where: { schoolId, gradeLevelId: { in: levelIds }, ...(isAdmin ? {} : { authorId: ctx.user.id }) },
      select: { id: true, title: true, gradeLevelId: true, subjectId: true, kind: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    // Matières que l'enseignant a dans chaque classe (emploi du temps) : proposées en premier.
    db.timetableEntry.findMany({ where: { schoolId, teacher: { userId: ctx.user.id } }, select: { classGroupId: true, subjectId: true } }),
  ]);
  const e = dict.exams;
  const labels: ExamFormLabels = {
    form: { ...formLabels(dict, e.save), errors: dict.formErrors as Record<string, string> },
    steps: e.steps,
    class: e.class,
    subject: e.subject,
    kind: e.kind,
    kinds: dict.grades.kinds,
    date: e.date,
    time: e.time,
    duration: e.duration,
    room: e.room,
    label: e.label,
    labelPlaceholder: e.labelPlaceholder,
    revision: e.revision,
    revisionPlaceholder: e.revisionPlaceholder,
    revisionHint: e.revisionHint,
    paper: e.paper,
    paperHint: e.paperHint,
    noPaper: e.noPaper,
    makePaper: e.makePaper,
    notify: e.notify,
    optional: dict.common.optional,
  };
  return {
    labels,
    aiOn: can(ctx.roles, "ai.use") && aiEnabled(),
    classes: classes.map((c) => ({
      id: c.id,
      label: `${className(c, lang)} · ${pickName(c.gradeLevel, lang)}`,
      levelId: c.gradeLevelId,
      ai: c.gradeLevel.cycle === "PRIMARY",
      subjects: [
        ...new Set([
          ...mine.filter((m) => m.classGroupId === c.id).map((m) => m.subjectId),
          ...curriculum.filter((x) => x.gradeLevelId === c.gradeLevelId && (x.trackId == null || x.trackId === c.trackId)).map((x) => x.subjectId),
        ]),
      ],
    })),
    subjects: subjects.map((s) => ({ id: s.id, label: pickName(s, lang) })),
    resources: resources.map((r) => ({ id: r.id, label: `${dict.workshop.kinds[r.kind].title} · ${r.title}`, levelId: r.gradeLevelId, subjectId: r.subjectId, kind: r.kind })),
  };
}

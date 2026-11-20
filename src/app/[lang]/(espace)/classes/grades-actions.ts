"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { t } from "@/i18n/format";
import { alertGuardiansOf } from "@/lib/data/alerts";
import { parseForm, runAction } from "@/lib/actions";
import { FormError, optionalText } from "@/lib/forms";
import { applyDefaultCurriculum } from "@/lib/setup/curriculum";
import { loadSchemeResolver } from "@/lib/grades/scheme";

/** Lit un nombre saisi au clavier ("12,5" ou "12.5"). Vide → null. */
function parseNumber(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) throw new FormError("invalid");
  return n;
}

async function findClass(schoolId: string, classId: string) {
  const cls = await db.classGroup.findFirst({ where: { schoolId, id: classId } });
  if (!cls) throw new FormError("notFound");
  return cls;
}

// ---------------------------------------------------------------------------
// Matières et coefficients
// ---------------------------------------------------------------------------

/** Enregistre les coefficients (champ "coef_<matière>") du niveau/filière de la classe. */
export async function saveCurriculum(lang: string, classId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "classes.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const cls = await findClass(schoolId, classId);
    const subjects = await db.subject.findMany({ where: { schoolId } });
    const scope = { schoolId, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId };

    await db.$transaction(async (tx) => {
      for (const subject of subjects) {
        const coef = parseNumber(formData.get(`coef_${subject.id}`));
        if (coef !== null && (coef <= 0 || coef > 20)) throw new FormError("invalid");
        const existing = await tx.curriculumSubject.findFirst({ where: { ...scope, subjectId: subject.id } });
        if (coef === null) {
          if (existing) await tx.curriculumSubject.delete({ where: { id: existing.id } });
        } else if (existing) {
          await tx.curriculumSubject.update({ where: { id: existing.id }, data: { coefficient: coef } });
        } else {
          await tx.curriculumSubject.create({ data: { ...scope, subjectId: subject.id, coefficient: coef } });
        }
      }
    });
    refresh();
  });
}

export async function applyDefaults(lang: string, classId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classes.write", async (ctx) => {
    const cls = await findClass(ctx.school.id, classId);
    await applyDefaultCurriculum(db, ctx.school.id, cls.gradeLevelId, cls.trackId);
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Évaluations et notes
// ---------------------------------------------------------------------------

const assessmentSchema = z.object({
  subjectId: z.string().min(1),
  kind: z.enum(["CONTROL", "SYNTHESIS", "ORAL", "PRACTICAL", "OTHER"]),
  title: optionalText,
  date: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime())),
  maxScore: z.string().optional().transform((v) => Number((v || "20").replace(",", "."))).pipe(z.number().positive().max(100)),
  weight: z.string().optional().transform((v) => Number((v || "1").replace(",", "."))).pipe(z.number().positive().max(10)),
});

export async function createAssessment(lang: string, classId: string, termId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "grades.write", async (ctx, l) => {
    const schoolId = ctx.school.id;
    const cls = await findClass(schoolId, classId);
    const data = parseForm(assessmentSchema, formData);
    // Le trimestre doit être de la même année que la classe ; la matière doit être au programme.
    const term = await db.term.findFirst({ where: { id: termId, schoolId, academicYearId: cls.academicYearId } });
    const taught = await db.curriculumSubject.findFirst({
      where: { schoolId, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId, subjectId: data.subjectId },
    });
    if (!term || !taught) throw new FormError("invalid");

    const a = await db.assessment.create({ data: { ...data, schoolId, classGroupId: cls.id, termId: term.id } });
    redirect(`/${l}/classes/${cls.id}/notes/${a.id}`);
  });
}

export async function deleteAssessment(lang: string, assessmentId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "grades.write", async (ctx, l) => {
    const a = await db.assessment.findFirst({ where: { id: assessmentId, schoolId: ctx.school.id } });
    if (!a) throw new FormError("notFound");
    await db.assessment.delete({ where: { id: a.id } });
    redirect(`/${l}/classes/${a.classGroupId}/notes?trimestre=${a.termId}`);
  });
}

/** Enregistre les notes d'une évaluation (champs "score_<élève>" et "absent_<élève>"). */
export async function saveGrades(lang: string, assessmentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "grades.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const a = await db.assessment.findFirst({
      where: { id: assessmentId, schoolId },
      include: { classGroup: { include: { enrollments: { where: { status: "ACTIVE" } } } } },
    });
    if (!a) throw new FormError("notFound");
    const max = Number(a.maxScore);

    const rows = a.classGroup.enrollments.map(({ studentId }) => {
      const absent = formData.get(`absent_${studentId}`) === "on";
      const score = absent ? null : parseNumber(formData.get(`score_${studentId}`));
      if (score !== null && (score < 0 || score > max)) throw new FormError("scoreRange");
      return { studentId, score, absent };
    });

    await db.$transaction(
      rows.map((r) =>
        db.grade.upsert({
          where: { assessmentId_studentId: { assessmentId: a.id, studentId: r.studentId } },
          update: { score: r.score, absent: r.absent },
          create: { schoolId, assessmentId: a.id, ...r },
        }),
      ),
    );
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Bulletins
// ---------------------------------------------------------------------------

export async function saveTermComment(lang: string, studentId: string, termId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "grades.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const [student, term] = await Promise.all([
      db.student.findFirst({ where: { id: studentId, schoolId } }),
      db.term.findFirst({ where: { id: termId, schoolId } }),
    ]);
    if (!student || !term) throw new FormError("notFound");
    const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
    if (!comment) {
      await db.termComment.deleteMany({ where: { studentId, termId } });
    } else {
      await db.termComment.upsert({
        where: { studentId_termId: { studentId, termId } },
        update: { comment },
        create: { schoolId, studentId, termId, comment },
      });
    }
    refresh();
  });
}

/** Publie (ou dépublie) les bulletins d'une classe pour un trimestre. */
export async function setPublication(lang: string, classId: string, termId: string, publish: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "reportCards.publish", async (ctx) => {
    const schoolId = ctx.school.id;
    const cls = await findClass(schoolId, classId);
    const term = await db.term.findFirst({ where: { id: termId, schoolId, academicYearId: cls.academicYearId } });
    if (!term) throw new FormError("notFound");
    if (publish) {
      const already = await db.reportCardPublication.findUnique({ where: { classGroupId_termId: { classGroupId: cls.id, termId } } });
      await db.reportCardPublication.upsert({
        where: { classGroupId_termId: { classGroupId: cls.id, termId } },
        update: { publishedAt: new Date() },
        create: { schoolId, classGroupId: cls.id, termId },
      });
      // Première publication : on prévient les parents par SMS.
      if (!already && ctx.school.alertReportCard) {
        const enrolled = await db.enrollment.findMany({ where: { schoolId, classGroupId: cls.id, status: "ACTIVE" }, select: { studentId: true } });
        await alertGuardiansOf(ctx.school, enrolled.map((e) => e.studentId), "REPORT_CARD", (d, lg, v) =>
          t(d.alerts.reportCard, { ...v, term: lg === "ar" ? term.nameAr : term.nameFr }),
        );
      }
    } else {
      await db.reportCardPublication.deleteMany({ where: { classGroupId: cls.id, termId } });
    }
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Structure des notes (oral, contrôle, synthèse...)
// ---------------------------------------------------------------------------

const KINDS = ["ORAL", "CONTROL", "SYNTHESIS", "PRACTICAL", "OTHER"] as const;

/** Endroit où la règle s'applique, à partir d'une classe de référence. */
async function schemeScope(schoolId: string, classId: string, scope: string, subjectId: string | null) {
  const cls = await findClass(schoolId, classId);
  if (subjectId && !(await db.subject.findFirst({ where: { id: subjectId, schoolId } }))) throw new FormError("invalid");
  if (scope === "class") return { schoolId, classGroupId: cls.id, gradeLevelId: null, trackId: null, subjectId };
  if (scope === "level") return { schoolId, classGroupId: null, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId, subjectId };
  if (scope === "school") return { schoolId, classGroupId: null, gradeLevelId: null, trackId: null, subjectId: null };
  throw new FormError("invalid");
}

/** Enregistre une structure (champs "use_<type>" et "weight_<type>"). */
export async function saveScheme(lang: string, classId: string, subjectId: string | null, _prev: FormState, formData: FormData) {
  return runAction(lang, "classes.write", async (ctx) => {
    const where = await schemeScope(ctx.school.id, classId, String(formData.get("scope") ?? ""), subjectId);
    const items = KINDS.filter((k) => formData.get(`use_${k}`) === "on").map((kind) => {
      const weight = parseNumber(formData.get(`weight_${kind}`)) ?? 1;
      if (weight <= 0 || weight > 10) throw new FormError("invalid");
      return { kind, weight };
    });
    if (items.length === 0) throw new FormError("noKind");

    await db.$transaction(async (tx) => {
      const existing = await tx.evaluationScheme.findFirst({ where });
      const scheme = existing ?? (await tx.evaluationScheme.create({ data: where }));
      await tx.evaluationSchemeItem.deleteMany({ where: { schemeId: scheme.id } });
      await tx.evaluationSchemeItem.createMany({ data: items.map((i) => ({ ...i, schemeId: scheme.id })) });
    });
    refresh();
  });
}

/** Supprime la règle à un endroit (la règle plus générale reprend la main). */
export async function deleteScheme(lang: string, schemeId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classes.write", async (ctx) => {
    await db.evaluationScheme.deleteMany({ where: { id: schemeId, schoolId: ctx.school.id } });
    refresh();
  });
}

/**
 * Enregistre la grille de notes d'une matière : un champ "g_<type>_<élève>"
 * par case. "abs" (ou "a", "غ") = absent. Les évaluations de chaque type sont
 * créées automatiquement si besoin.
 */
export async function saveGradeGrid(lang: string, classId: string, termId: string, subjectId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "grades.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const cls = await db.classGroup.findFirst({
      where: { schoolId, id: classId },
      include: { enrollments: { where: { status: "ACTIVE" } } },
    });
    if (!cls) throw new FormError("notFound");
    const term = await db.term.findFirst({ where: { id: termId, schoolId, academicYearId: cls.academicYearId } });
    const taught = await db.curriculumSubject.findFirst({
      where: { schoolId, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId, subjectId },
    });
    if (!term || !taught) throw new FormError("invalid");

    const scheme = (await loadSchemeResolver(db, schoolId, cls))(subjectId);

    // Lecture et contrôle de toutes les cases avant d'écrire quoi que ce soit.
    const cells = scheme.items.flatMap(({ kind }) =>
      cls.enrollments.map(({ studentId }) => {
        const raw = String(formData.get(`g_${kind}_${studentId}`) ?? "").trim().toLowerCase();
        const absent = ["abs", "a", "غ"].includes(raw);
        const score = absent ? null : parseNumber(raw);
        if (score !== null && (score < 0 || score > 20)) throw new FormError("scoreRange");
        return { kind, studentId, score, absent };
      }),
    );

    await db.$transaction(async (tx) => {
      for (const { kind, weight } of scheme.items) {
        const existing = await tx.assessment.findFirst({
          where: { schoolId, classGroupId: cls.id, termId: term.id, subjectId, kind },
          orderBy: { createdAt: "asc" },
        });
        const assessment =
          existing ??
          (await tx.assessment.create({ data: { schoolId, classGroupId: cls.id, termId: term.id, subjectId, kind, weight } }));
        for (const c of cells.filter((x) => x.kind === kind)) {
          await tx.grade.upsert({
            where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: c.studentId } },
            update: { score: c.score, absent: c.absent },
            create: { schoolId, assessmentId: assessment.id, studentId: c.studentId, score: c.score, absent: c.absent },
          });
        }
      }
    });
    refresh();
  });
}

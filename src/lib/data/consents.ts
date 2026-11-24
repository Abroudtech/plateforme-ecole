import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { db } from "@/lib/db";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };
type Target = { audience: "SCHOOL" | "LEVEL" | "CLASS"; gradeLevelId: string | null; classGroupId: string | null };

/** Élèves concernés par une demande (inscrits cette année dans l'école, le niveau ou la classe). */
export function consentStudents(schoolId: string, r: Target) {
  return db.enrollment.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      academicYear: { isCurrent: true },
      ...(r.audience === "CLASS" ? { classGroupId: r.classGroupId ?? "-" } : r.audience === "LEVEL" ? { classGroup: { gradeLevelId: r.gradeLevelId ?? "-" } } : {}),
    },
    include: {
      student: { include: { guardians: { include: { guardian: { select: { userId: true } } } } } },
      classGroup: { select: { id: true, name: true, nameAr: true } },
    },
    orderBy: [{ classGroup: { name: "asc" } }, { student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
}

/** Demandes visibles par l'équipe : toutes pour la direction ; pour un enseignant, celles de ses classes. */
export async function listConsentsForStaff(ctx: Ctx) {
  const scope = await scopeOf(ctx);
  return db.consentRequest.findMany({
    where: {
      schoolId: ctx.school.id,
      ...(scope ? { OR: [{ createdById: ctx.user.id }, { audience: "CLASS", classGroupId: { in: scope } }] } : {}),
    },
    include: { replies: { select: { accepted: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}

/** L'équipe peut-elle voir cette demande ? */
export async function canSeeConsent(ctx: Ctx, r: { schoolId: string; createdById: string | null; audience: string; classGroupId: string | null }) {
  if (r.schoolId !== ctx.school.id) return false;
  const scope = await scopeOf(ctx);
  return scope === null || r.createdById === ctx.user.id || (r.audience === "CLASS" && !!r.classGroupId && scope.includes(r.classGroupId));
}

/** Pour un parent : ses enfants (cette année) et les demandes qui les concernent, avec ses réponses. */
export async function consentsForParent(schoolId: string, userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { schoolId, status: "ACTIVE", academicYear: { isCurrent: true }, student: { isActive: true, guardians: { some: { guardian: { userId } } } } },
    include: { student: true, classGroup: true },
  });
  if (enrollments.length === 0) return [];
  const requests = await db.consentRequest.findMany({
    where: {
      schoolId,
      createdAt: { gt: new Date(Date.now() - 180 * 86_400_000) },
      OR: [
        { audience: "SCHOOL" },
        { audience: "LEVEL", gradeLevelId: { in: enrollments.map((e) => e.classGroup.gradeLevelId) } },
        { audience: "CLASS", classGroupId: { in: enrollments.map((e) => e.classGroupId) } },
      ],
    },
    include: { replies: { where: { studentId: { in: enrollments.map((e) => e.studentId) } } } },
    orderBy: { createdAt: "desc" },
  });
  // Une ligne par demande et par enfant concerné.
  return requests.flatMap((r) =>
    enrollments
      .filter((e) => r.audience === "SCHOOL" || (r.audience === "LEVEL" ? e.classGroup.gradeLevelId === r.gradeLevelId : e.classGroupId === r.classGroupId))
      .map((e) => ({ request: r, student: e.student, reply: r.replies.find((x) => x.studentId === e.studentId) ?? null, childCount: enrollments.length })),
  );
}

/** Une demande est fermée après sa date limite (heure de Tunis, jour inclus). */
export function consentClosed(deadline: Date | null, todayIso: string) {
  return !!deadline && deadline.toISOString().slice(0, 10) < todayIso;
}

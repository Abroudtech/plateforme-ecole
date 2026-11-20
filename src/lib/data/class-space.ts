import "server-only";
import { cache } from "react";
import { POINTS_PER_CHALLENGE_ANSWER, rankRows } from "@/lib/challenges";
import { db } from "@/lib/db";
import { scopeOf } from "@/lib/auth/scope";
import type { AppContext } from "@/lib/auth/context";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };

/** Fiche de l'élève connecté et sa classe de l'année en cours. */
export const studentOf = cache(async (schoolId: string, userId: string) => {
  const student = await db.student.findFirst({
    where: { schoolId, userId, isActive: true },
    include: {
      enrollments: {
        where: { status: "ACTIVE", academicYear: { isCurrent: true } },
        include: { classGroup: { include: { gradeLevel: true } } },
        take: 1,
      },
    },
  });
  if (!student) return null;
  return { ...student, classGroup: student.enrollments[0]?.classGroup ?? null };
});

/** Classes que l'enseignant (ou la direction) anime dans l'espace de classe. */
export async function managedClasses(ctx: Ctx) {
  const scope = await scopeOf(ctx);
  return db.classGroup.findMany({
    where: { schoolId: ctx.school.id, academicYear: { isCurrent: true }, ...(scope ? { id: { in: scope } } : {}) },
    include: { gradeLevel: true },
    orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
  });
}

/** Lundi de la semaine en cours, à minuit (UTC, à une heure près de Tunis). */
export function weekStart(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** Classement d'une classe : points des défis et des jeux, depuis une date (ou toute l'année). */
export async function leaderboard(schoolId: string, classGroupId: string, since?: Date) {
  const created = since ? { gte: since } : undefined;
  const [enrollments, attempts, games] = await Promise.all([
    db.enrollment.findMany({
      where: { schoolId, classGroupId, status: "ACTIVE" },
      include: { student: true },
    }),
    db.challengeAttempt.groupBy({
      by: ["studentId"],
      where: { schoolId, challenge: { classGroupId }, createdAt: created },
      _sum: { score: true },
    }),
    db.gameScore.groupBy({
      by: ["studentId"],
      where: { schoolId, classGroupId, createdAt: created },
      _sum: { score: true },
    }),
  ]);
  const challengePts = new Map(attempts.map((a) => [a.studentId, (a._sum.score ?? 0) * POINTS_PER_CHALLENGE_ANSWER]));
  const gamePts = new Map(games.map((g) => [g.studentId, g._sum.score ?? 0]));
  return rankRows(
    enrollments.map((e) => ({
      student: e.student,
      points: (challengePts.get(e.studentId) ?? 0) + (gamePts.get(e.studentId) ?? 0),
    })),
  );
}

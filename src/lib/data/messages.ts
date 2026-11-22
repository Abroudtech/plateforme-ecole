import "server-only";
import type { Role } from "@prisma/client";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

/** Fiche parent liée au compte connecté (dans cette école). */
export function getGuardianForUser(schoolId: string, userId: string) {
  return db.guardian.findFirst({
    where: { schoolId, userId },
    include: { students: { include: { student: true } } },
  });
}

/**
 * Qui lit la messagerie :
 * - la direction (`schoolSide`) voit toutes les conversations de l'école ;
 * - un enseignant voit celles où il est l'interlocuteur (si l'école l'autorise) ;
 * - un parent voit les siennes.
 * Une même personne peut être à la fois enseignant et parent.
 */
export type Viewer = { userId: string; schoolSide: boolean; guardianId: string | null; teacherId: string | null };

export async function messagingViewer(ctx: { roles: readonly Role[]; user: { id: string }; school: { id: string; teacherMessaging: boolean } }): Promise<Viewer> {
  const schoolSide = can(ctx.roles, "messages.school");
  const [guardian, teacher] = await Promise.all([
    can(ctx.roles, "children.read") ? db.guardian.findFirst({ where: { schoolId: ctx.school.id, userId: ctx.user.id }, select: { id: true } }) : null,
    !schoolSide && ctx.school.teacherMessaging && ctx.roles.includes("TEACHER")
      ? db.teacher.findFirst({ where: { schoolId: ctx.school.id, userId: ctx.user.id, isActive: true }, select: { id: true } })
      : null,
  ]);
  return { userId: ctx.user.id, schoolSide, guardianId: guardian?.id ?? null, teacherId: teacher?.id ?? null };
}

/** Vrai si la personne est le parent de cette conversation (et non l'école). */
export function isParentIn(conv: { guardianId: string }, v: Viewer) {
  return v.guardianId != null && conv.guardianId === v.guardianId;
}

export function canSee(conv: { guardianId: string; teacherId: string | null }, v: Viewer) {
  return v.schoolSide || isParentIn(conv, v) || (conv.teacherId != null && conv.teacherId === v.teacherId);
}

/** Conversations visibles, avec l'indicateur « non lu ». */
export async function listConversations(schoolId: string, v: Viewer) {
  const or = [...(v.guardianId ? [{ guardianId: v.guardianId }] : []), ...(v.teacherId ? [{ teacherId: v.teacherId }] : [])];
  if (!v.schoolSide && or.length === 0) return [];
  const conversations = await db.conversation.findMany({
    where: { schoolId, ...(v.schoolSide ? {} : { OR: or }) },
    include: {
      guardian: true,
      student: true,
      teacher: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      reads: { where: { userId: v.userId } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  return conversations.map((c) => {
    const last = c.messages[0] ?? null;
    const readAt = c.reads[0]?.lastReadAt ?? null;
    const mySideIsSchool = !isParentIn(c, v);
    const fromOtherSide = last ? last.fromSchool !== mySideIsSchool : false;
    return { ...c, last, unread: !!last && fromOtherSide && (!readAt || readAt < last.createdAt) };
  });
}

export async function countUnread(schoolId: string, v: Viewer) {
  return (await listConversations(schoolId, v)).filter((c) => c.unread).length;
}

export function getConversation(schoolId: string, id: string) {
  return db.conversation.findFirst({
    where: { id, schoolId },
    include: {
      guardian: { include: { students: { include: { student: true } } } },
      student: true,
      teacher: true,
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
}

/**
 * Enseignants d'un élève cette année (classe confiée ou emploi du temps),
 * qui ont un compte pour recevoir les messages, avec leurs matières.
 */
export async function teachersOfStudents(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return [];
  const enrollments = await db.enrollment.findMany({
    where: { schoolId, studentId: { in: studentIds }, status: "ACTIVE", academicYear: { isCurrent: true } },
    select: { studentId: true, classGroupId: true },
  });
  const classIds = [...new Set(enrollments.map((e) => e.classGroupId))];
  if (classIds.length === 0) return [];
  const teachers = await db.teacher.findMany({
    where: {
      schoolId,
      isActive: true,
      userId: { not: null },
      OR: [{ assignments: { some: { classGroupId: { in: classIds } } } }, { entries: { some: { classGroupId: { in: classIds } } } }],
    },
    include: {
      assignments: { where: { classGroupId: { in: classIds } }, select: { classGroupId: true } },
      entries: { where: { classGroupId: { in: classIds } }, select: { classGroupId: true, subject: true } },
    },
    orderBy: { lastName: "asc" },
  });
  return teachers.map((t) => {
    const classes = new Set([...t.assignments, ...t.entries].map((x) => x.classGroupId));
    const subjects = [...new Map(t.entries.map((e) => [e.subject.id, e.subject])).values()];
    return {
      teacher: t,
      subjects,
      studentIds: enrollments.filter((e) => classes.has(e.classGroupId)).map((e) => e.studentId),
    };
  });
}

export function markRead(conversationId: string, userId: string) {
  const now = new Date();
  return db.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: { lastReadAt: now },
    create: { conversationId, userId, lastReadAt: now },
  });
}

/** Annonces visibles par un parent : école entière, niveaux et classes de ses enfants. */
export function listAnnouncementsFor(schoolId: string, scope: { levelIds: string[]; classIds: string[] } | null, take = 50) {
  return db.announcement.findMany({
    where: {
      schoolId,
      ...(scope
        ? {
            OR: [
              { audience: "SCHOOL" },
              { audience: "LEVEL", gradeLevelId: { in: scope.levelIds } },
              { audience: "CLASS", classGroupId: { in: scope.classIds } },
            ],
          }
        : {}),
    },
    include: { gradeLevel: true, classGroup: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Niveaux et classes des enfants d'un parent cette année. */
export async function parentScope(schoolId: string, guardianId: string, academicYearId: string | null) {
  if (!academicYearId) return { levelIds: [], classIds: [] };
  const enrollments = await db.enrollment.findMany({
    where: { schoolId, academicYearId, status: "ACTIVE", student: { guardians: { some: { guardianId } } } },
    include: { classGroup: true },
  });
  return {
    levelIds: [...new Set(enrollments.map((e) => e.classGroup.gradeLevelId))],
    classIds: [...new Set(enrollments.map((e) => e.classGroupId))],
  };
}

import "server-only";
import { db } from "@/lib/db";

/** Fiche parent liée au compte connecté (dans cette école). */
export function getGuardianForUser(schoolId: string, userId: string) {
  return db.guardian.findFirst({
    where: { schoolId, userId },
    include: { students: { include: { student: true } } },
  });
}

/** Conversations (toutes pour l'école, ou celles d'un parent), avec l'indicateur « non lu ». */
export async function listConversations(schoolId: string, userId: string, guardianId: string | null) {
  const conversations = await db.conversation.findMany({
    where: { schoolId, ...(guardianId ? { guardianId } : {}) },
    include: {
      guardian: true,
      student: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      reads: { where: { userId } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  const schoolSide = guardianId == null;
  return conversations.map((c) => {
    const last = c.messages[0] ?? null;
    const readAt = c.reads[0]?.lastReadAt ?? null;
    const fromOtherSide = last ? last.fromSchool !== schoolSide : false;
    return { ...c, last, unread: !!last && fromOtherSide && (!readAt || readAt < last.createdAt) };
  });
}

export async function countUnread(schoolId: string, userId: string, guardianId: string | null) {
  return (await listConversations(schoolId, userId, guardianId)).filter((c) => c.unread).length;
}

export function getConversation(schoolId: string, id: string) {
  return db.conversation.findFirst({
    where: { id, schoolId },
    include: {
      guardian: { include: { students: { include: { student: true } } } },
      student: true,
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
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

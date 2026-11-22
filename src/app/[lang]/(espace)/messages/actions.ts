"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { School } from "@prisma/client";
import type { FormState } from "@/components/action-form";
import { t } from "@/i18n/format";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { alertGuardian, alertGuardiansOf, retryFailed } from "@/lib/data/alerts";
import { canSee, getGuardianForUser, isParentIn, messagingViewer, teachersOfStudents } from "@/lib/data/messages";
import { hasStudentAccess } from "@/lib/auth/scope";
import { getPrimaryGuardian } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { FormError, requiredText } from "@/lib/forms";
import { schoolAdminIds, sendPush } from "@/lib/push";
import { after } from "next/server";
import type { Locale } from "@/i18n/config";

const body = z.string().trim().min(1).max(4000);

type Conv = { id: string; subject: string; teacherId: string | null };

/**
 * Un parent a écrit : on prévient l'enseignant concerné, ou la direction
 * (notification sur le téléphone).
 */
function notifyStaff(school: { id: string; nameFr: string; nameAr: string }, conv: Conv, lang: Locale) {
  after(async () => {
    const teacher = conv.teacherId ? await db.teacher.findUnique({ where: { id: conv.teacherId }, select: { userId: true } }) : null;
    const ids = teacher?.userId ? [teacher.userId] : await schoolAdminIds(school.id);
    await sendPush(ids, { title: lang === "ar" ? school.nameAr : school.nameFr, body: conv.subject, url: `/${lang}/messages/${conv.id}`, tag: conv.id });
  });
}

/** L'école a écrit : alerte au parent ; si c'est la direction dans une conversation d'enseignant, l'enseignant est prévenu aussi. */
async function notifyParent(
  school: School,
  guardianId: string,
  conv: Conv,
  authorId: string,
  lang: Locale,
) {
  if (school.alertMessage) await alertGuardian(school, guardianId, "MESSAGE", (d, _lg, v) => t(d.alerts.message, v));
  if (conv.teacherId) {
    after(async () => {
      const teacher = await db.teacher.findUnique({ where: { id: conv.teacherId! }, select: { userId: true } });
      if (teacher?.userId && teacher.userId !== authorId) {
        await sendPush([teacher.userId], { title: lang === "ar" ? school.nameAr : school.nameFr, body: conv.subject, url: `/${lang}/messages/${conv.id}`, tag: conv.id });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function startConversation(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "messages.send", async (ctx, l) => {
    const data = parseForm(z.object({ studentId: z.string().min(1), subject: requiredText, body, to: z.string().optional() }), formData);
    const schoolId = ctx.school.id;
    const student = await db.student.findFirst({ where: { id: data.studentId, schoolId } });
    if (!student) throw new FormError("notFound");
    const viewer = await messagingViewer(ctx);

    // Qui écrit : le parent (si c'est son enfant), sinon la direction ou l'enseignant.
    const guardian = viewer.guardianId ? await getGuardianForUser(schoolId, ctx.user.id) : null;
    const asParent = !!guardian && guardian.students.some((s) => s.studentId === student.id);
    let guardianId: string;
    let teacherId: string | null = null;
    if (asParent) {
      guardianId = guardian!.id;
      if (data.to && data.to !== "school") {
        if (!ctx.school.teacherMessaging) throw new FormError("wrongTeacher");
        const ok = (await teachersOfStudents(schoolId, [student.id])).some((x) => x.teacher.id === data.to);
        if (!ok) throw new FormError("wrongTeacher");
        teacherId = data.to;
      }
    } else if (viewer.schoolSide || (viewer.teacherId && (await hasStudentAccess(ctx, student.id)))) {
      const g = await getPrimaryGuardian(schoolId, student.id);
      if (!g) throw new FormError("noGuardian");
      guardianId = g.id;
      teacherId = viewer.schoolSide ? null : viewer.teacherId;
    } else {
      throw new FormError("notFound");
    }
    const fromSchool = !asParent;
    const conv = await db.conversation.create({
      data: {
        schoolId,
        guardianId,
        teacherId,
        studentId: student.id,
        subject: data.subject,
        messages: { create: { authorId: ctx.user.id, fromSchool, body: data.body } },
        reads: { create: { userId: ctx.user.id, lastReadAt: new Date() } },
      },
    });
    if (fromSchool) await notifyParent(ctx.school, guardianId, conv, ctx.user.id, l);
    else notifyStaff(ctx.school, conv, l);
    redirect(`/${l}/messages/${conv.id}`);
  });
}

export async function replyMessage(lang: string, conversationId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "messages.send", async (ctx, l) => {
    const data = parseForm(z.object({ body }), formData);
    const conv = await db.conversation.findFirst({ where: { id: conversationId, schoolId: ctx.school.id } });
    if (!conv) throw new FormError("notFound");
    const viewer = await messagingViewer(ctx);
    if (!canSee(conv, viewer)) throw new FormError("notFound");
    const fromSchool = !isParentIn(conv, viewer);
    const now = new Date();
    await db.$transaction([
      db.message.create({ data: { conversationId: conv.id, authorId: ctx.user.id, fromSchool, body: data.body, createdAt: now } }),
      db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } }),
      db.conversationRead.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId: ctx.user.id } },
        update: { lastReadAt: now },
        create: { conversationId: conv.id, userId: ctx.user.id, lastReadAt: now },
      }),
    ]);
    if (fromSchool) await notifyParent(ctx.school, conv.guardianId, conv, ctx.user.id, l);
    else notifyStaff(ctx.school, conv, l);
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

export async function createAnnouncement(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "announcements.write", async (ctx) => {
    const data = parseForm(
      z.object({
        title: requiredText,
        body,
        audience: z.enum(["SCHOOL", "LEVEL", "CLASS"]),
        gradeLevelId: z.string().optional(),
        classGroupId: z.string().optional(),
        sendAlert: z.string().optional(),
      }),
      formData,
    );
    const schoolId = ctx.school.id;
    const year = await getCurrentYear(schoolId);
    let gradeLevelId: string | null = null;
    let classGroupId: string | null = null;
    if (data.audience === "LEVEL") {
      const lv = data.gradeLevelId && (await db.gradeLevel.findFirst({ where: { id: data.gradeLevelId, schoolId } }));
      if (!lv) throw new FormError("audienceMissing");
      gradeLevelId = lv.id;
    } else if (data.audience === "CLASS") {
      const cg = data.classGroupId && (await db.classGroup.findFirst({ where: { id: data.classGroupId, schoolId } }));
      if (!cg) throw new FormError("audienceMissing");
      classGroupId = cg.id;
    }
    const sendAlert = data.sendAlert === "on";
    await db.announcement.create({
      data: { schoolId, title: data.title, body: data.body, audience: data.audience, gradeLevelId, classGroupId, sendAlert, createdById: ctx.user.id },
    });
    if (sendAlert && year) {
      const enrollments = await db.enrollment.findMany({
        where: {
          schoolId,
          academicYearId: year.id,
          status: "ACTIVE",
          ...(classGroupId ? { classGroupId } : gradeLevelId ? { classGroup: { gradeLevelId } } : {}),
        },
        select: { studentId: true },
      });
      await alertGuardiansOf(
        ctx.school,
        enrollments.map((e) => e.studentId),
        "ANNOUNCEMENT",
        (d, _lg, v) => t(d.alerts.announcement, { ...v, title: data.title }),
        { oncePerGuardian: true },
      );
    }
    refresh();
  });
}

export async function deleteAnnouncement(lang: string, id: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "announcements.write", async (ctx) => {
    await db.announcement.deleteMany({ where: { id, schoolId: ctx.school.id } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Alertes SMS
// ---------------------------------------------------------------------------

export async function saveAlertSettings(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "alerts.manage", async (ctx) => {
    await db.school.update({
      where: { id: ctx.school.id },
      data: {
        alertAbsence: formData.get("alertAbsence") === "on",
        alertReportCard: formData.get("alertReportCard") === "on",
        alertMessage: formData.get("alertMessage") === "on",
        smsOnlyWithoutApp: formData.get("smsOnlyWithoutApp") === "on",
      },
    });
    refresh();
  });
}

export async function retryAlerts(lang: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "alerts.manage", async (ctx) => {
    await retryFailed(ctx.school.id);
    refresh();
  });
}

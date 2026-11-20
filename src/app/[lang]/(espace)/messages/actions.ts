"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { t } from "@/i18n/format";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { alertGuardian, alertGuardiansOf, retryFailed } from "@/lib/data/alerts";
import { getGuardianForUser } from "@/lib/data/messages";
import { getPrimaryGuardian } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { FormError, requiredText } from "@/lib/forms";

const body = z.string().trim().min(1).max(4000);

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function startConversation(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "messages.send", async (ctx, l) => {
    const data = parseForm(z.object({ studentId: z.string().min(1), subject: requiredText, body }), formData);
    const schoolId = ctx.school.id;
    const student = await db.student.findFirst({ where: { id: data.studentId, schoolId } });
    if (!student) throw new FormError("notFound");

    const fromSchool = can(ctx.roles, "messages.school");
    let guardianId: string;
    if (fromSchool) {
      const g = await getPrimaryGuardian(schoolId, student.id);
      if (!g) throw new FormError("noGuardian");
      guardianId = g.id;
    } else {
      const g = await getGuardianForUser(schoolId, ctx.user.id);
      if (!g || !g.students.some((s) => s.studentId === student.id)) throw new FormError("notFound");
      guardianId = g.id;
    }
    const conv = await db.conversation.create({
      data: {
        schoolId,
        guardianId,
        studentId: student.id,
        subject: data.subject,
        messages: { create: { authorId: ctx.user.id, fromSchool, body: data.body } },
        reads: { create: { userId: ctx.user.id, lastReadAt: new Date() } },
      },
    });
    if (fromSchool && ctx.school.alertMessage) {
      await alertGuardian(ctx.school, guardianId, "MESSAGE", (d, _lg, v) => t(d.alerts.message, v));
    }
    redirect(`/${l}/messages/${conv.id}`);
  });
}

export async function replyMessage(lang: string, conversationId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "messages.send", async (ctx) => {
    const data = parseForm(z.object({ body }), formData);
    const conv = await db.conversation.findFirst({ where: { id: conversationId, schoolId: ctx.school.id }, include: { guardian: true } });
    if (!conv) throw new FormError("notFound");
    const fromSchool = can(ctx.roles, "messages.school");
    if (!fromSchool && conv.guardian.userId !== ctx.user.id) throw new FormError("notFound");
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
    if (fromSchool && ctx.school.alertMessage) {
      await alertGuardian(ctx.school, conv.guardianId, "MESSAGE", (d, _lg, v) => t(d.alerts.message, v));
    }
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

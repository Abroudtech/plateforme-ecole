"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { parseForm, runAction } from "@/lib/actions";
import { scopeOf } from "@/lib/auth/scope";
import { canSeeConsent, consentClosed, consentStudents } from "@/lib/data/consents";
import { pushFamilies } from "@/lib/data/calendar";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";
import { sendPush } from "@/lib/push";

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  details: z.string().trim().max(3000).optional(),
  deadline: z.string().optional(),
  audience: z.string().min(1),
});

/** Nouvelle demande d'autorisation, envoyée aux parents concernés. */
export async function createConsent(lang: string, _prev: FormState, formData: FormData) {
  let goTo: string | null = null;
  const state = await runAction(lang, "consents.write", async (ctx, l) => {
    const data = parseForm(schema, formData);
    const schoolId = ctx.school.id;
    const deadline = data.deadline ? parseISODate(data.deadline) : null;
    if (data.deadline && !deadline) throw new FormError("dateInvalid");
    if (data.deadline && data.deadline < todayISO()) throw new FormError("examPast");

    // « SCHOOL », « level:<id> » ou « class:<id> » ; un enseignant ne vise que ses classes.
    const scope = await scopeOf(ctx);
    const [kind, targetId] = data.audience.split(":");
    let target: { audience: "SCHOOL" | "LEVEL" | "CLASS"; gradeLevelId: string | null; classGroupId: string | null };
    if (kind === "class" && (await db.classGroup.findFirst({ where: { id: targetId, schoolId } })) && (scope === null || scope.includes(targetId))) {
      target = { audience: "CLASS", gradeLevelId: null, classGroupId: targetId };
    } else if (scope === null && kind === "level" && (await db.gradeLevel.findFirst({ where: { id: targetId, schoolId } }))) {
      target = { audience: "LEVEL", gradeLevelId: targetId, classGroupId: null };
    } else if (scope === null && kind === "SCHOOL") {
      target = { audience: "SCHOOL", gradeLevelId: null, classGroupId: null };
    } else throw new FormError("forbidden");

    const r = await db.consentRequest.create({
      data: { schoolId, title: data.title, details: data.details || null, deadline, ...target, createdById: ctx.user.id },
    });
    after(() =>
      pushFamilies(schoolId, { classIds: target.classGroupId ? [target.classGroupId] : null, levelId: target.gradeLevelId }, (d, lg) => ({
        title: d.consents.pushTitle,
        body: r.title,
        url: `/${lg}/autorisations`,
        tag: `consent-${r.id}`,
      })),
    );
    goTo = `/${l}/autorisations/${r.id}`;
  });
  if (goTo) redirect(goTo);
  return state;
}

/** Le parent répond oui ou non pour un enfant (il peut changer d'avis jusqu'à la date limite). */
export async function answerConsent(lang: string, requestId: string, studentId: string, accepted: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "children.read", async (ctx) => {
    const schoolId = ctx.school.id;
    const r = await db.consentRequest.findFirst({ where: { id: requestId, schoolId } });
    if (!r) throw new FormError("notFound");
    if (consentClosed(r.deadline, todayISO())) throw new FormError("forbidden");
    // L'enfant doit être celui du parent, et concerné par la demande.
    const targeted = await consentStudents(schoolId, r);
    const e = targeted.find((x) => x.studentId === studentId);
    if (!e || !e.student.guardians.some((g) => g.guardian.userId === ctx.user.id)) throw new FormError("forbidden");
    await db.consentReply.upsert({
      where: { requestId_studentId: { requestId, studentId } },
      update: { accepted, userId: ctx.user.id },
      create: { requestId, studentId, accepted, userId: ctx.user.id },
    });
    refresh();
    return { ok: true };
  });
}

async function loadForStaff(ctx: Parameters<typeof canSeeConsent>[0], id: string) {
  const r = await db.consentRequest.findFirst({ where: { id, schoolId: ctx.school.id } });
  if (!r || !(await canSeeConsent(ctx, r))) throw new FormError("forbidden");
  return r;
}

/** Notification aux parents qui n'ont pas encore répondu. */
export async function remindConsent(lang: string, id: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "consents.write", async (ctx) => {
    const r = await loadForStaff(ctx, id);
    const [students, replies] = await Promise.all([consentStudents(ctx.school.id, r), db.consentReply.findMany({ where: { requestId: r.id }, select: { studentId: true } })]);
    const answered = new Set(replies.map((x) => x.studentId));
    const parents = students.filter((s) => !answered.has(s.studentId)).flatMap((s) => s.student.guardians.map((g) => g.guardian.userId).filter((u): u is string => !!u));
    after(() => sendPush(parents, { title: "⏰ " + r.title, body: r.details?.slice(0, 120) ?? r.title, url: `/${lang}/autorisations`, tag: `consent-${r.id}` }));
    return { ok: true };
  });
}

export async function deleteConsent(lang: string, id: string, _prev: FormState, _fd: FormData) {
  let done = false;
  const state = await runAction(lang, "consents.write", async (ctx) => {
    const r = await loadForStaff(ctx, id);
    if (!ctx.roles.includes("ADMIN") && r.createdById !== ctx.user.id) throw new FormError("forbidden");
    await db.consentRequest.delete({ where: { id: r.id } });
    done = true;
  });
  if (done) redirect(`/${lang}/autorisations`);
  return state;
}

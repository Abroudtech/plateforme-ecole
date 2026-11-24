"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { FormState } from "@/components/action-form";
import { isLocale } from "@/i18n/config";
import { runAction } from "@/lib/actions";
import { requireContext } from "@/lib/auth/context";
import { hasClassAccess } from "@/lib/auth/scope";
import { challengeQuestionsSchema } from "@/lib/challenges";
import { liveRole } from "@/lib/data/live";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";
import { acceptsAnswer, LIVE_SECONDS, livePoints, nextPhase, type LivePhase } from "@/lib/live";
import { sendPush } from "@/lib/push";

/** L'enseignant lance un défi en direct pour sa classe. */
export async function launchLive(lang: string, challengeId: string, _prev: FormState, formData: FormData) {
  let goTo: string | null = null;
  const state = await runAction(lang, "classSpace.manage", async (ctx, l) => {
    const c = await db.challenge.findFirst({ where: { id: challengeId, schoolId: ctx.school.id } });
    if (!c || !(await hasClassAccess(ctx, c.classGroupId))) throw new FormError("forbidden");
    const seconds = Number(formData.get("seconds") ?? 20);
    if (!LIVE_SECONDS.includes(seconds as (typeof LIVE_SECONDS)[number])) throw new FormError("invalid");
    // Un seul défi en direct à la fois par classe.
    await db.liveQuiz.updateMany({ where: { classGroupId: c.classGroupId, phase: { not: "DONE" } }, data: { phase: "DONE", endedAt: new Date() } });
    const live = await db.liveQuiz.create({ data: { schoolId: ctx.school.id, challengeId: c.id, classGroupId: c.classGroupId, hostId: ctx.user.id, seconds } });
    // Les élèves de la classe reçoivent une notification pour rejoindre.
    const students = await db.enrollment.findMany({
      where: { classGroupId: c.classGroupId, status: "ACTIVE", student: { userId: { not: null } } },
      select: { student: { select: { userId: true } } },
    });
    void sendPush(
      students.map((s) => s.student.userId!),
      { title: "⚡ Défi en direct · تحدٍّ مباشر", body: c.title, url: `/${l}/direct/${live.id}`, tag: `live-${live.id}` },
    );
    goTo = `/${l}/direct/${live.id}`;
  });
  if (goTo) redirect(goTo);
  return state;
}

async function loadFor(rawLang: string, liveId: string) {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requireContext(lang);
  const live = await db.liveQuiz.findFirst({ where: { id: liveId, schoolId: ctx.school.id }, include: { challenge: true } });
  if (!live) return null;
  const role = await liveRole(ctx, live);
  return role ? { ctx, live, role } : null;
}

/** Étape suivante (enseignant) : commencer, montrer la réponse, question suivante, terminer. */
export async function liveStep(rawLang: string, liveId: string, action: "start" | "reveal" | "next" | "end"): Promise<{ ok: boolean }> {
  const found = await loadFor(rawLang, liveId);
  if (!found || found.role.kind !== "host") return { ok: false };
  const { live } = found;
  const total = challengeQuestionsSchema.parse(live.challenge.questions).length;
  const next = nextPhase(live.phase as LivePhase, action, live.current, total);
  if (!next) return { ok: true }; // déjà fait (deux clics, ou passage automatique)
  // Mise à jour seulement si personne n'a changé l'étape entre-temps.
  const changed = await db.liveQuiz.updateMany({
    where: { id: live.id, phase: live.phase, current: live.current },
    data: {
      phase: next.phase,
      current: next.current,
      ...(next.phase === "QUESTION" ? { questionStartedAt: new Date() } : {}),
      ...(next.phase === "DONE" ? { endedAt: new Date() } : {}),
    },
  });
  if (changed.count === 1 && next.phase === "DONE") await recordAttempts(live.id);
  return { ok: true };
}

/**
 * À la fin, chaque participant reçoit une tentative du défi (s'il ne l'avait pas
 * déjà fait seul) : ses bonnes réponses comptent dans le classement de la classe.
 */
async function recordAttempts(liveId: string) {
  const live = await db.liveQuiz.findUniqueOrThrow({ where: { id: liveId }, include: { challenge: true, players: true, answers: true } });
  const questions = challengeQuestionsSchema.parse(live.challenge.questions);
  await db.challengeAttempt.createMany({
    skipDuplicates: true,
    data: live.players.map((p) => {
      const answers = questions.map((_, i) => live.answers.find((a) => a.studentId === p.studentId && a.question === i)?.choice ?? null);
      return {
        schoolId: live.schoolId,
        challengeId: live.challengeId,
        studentId: p.studentId,
        answers,
        score: questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0),
        maxScore: questions.length,
      };
    }),
  });
}

/** L'élève rejoint le défi (automatique à l'ouverture de la page). */
export async function joinLive(rawLang: string, liveId: string): Promise<{ ok: boolean }> {
  const found = await loadFor(rawLang, liveId);
  if (!found || found.role.kind !== "player" || found.live.phase === "DONE") return { ok: false };
  await db.livePlayer.upsert({
    where: { liveId_studentId: { liveId, studentId: found.role.studentId } },
    update: {},
    create: { liveId, studentId: found.role.studentId },
  });
  return { ok: true };
}

/** L'élève répond à la question en cours (une seule réponse). */
export async function answerLive(rawLang: string, liveId: string, question: number, choice: number): Promise<{ ok: boolean; error?: string }> {
  const found = await loadFor(rawLang, liveId);
  if (!found || found.role.kind !== "player") return { ok: false, error: "forbidden" };
  const { live, role } = found;
  if (live.phase !== "QUESTION" || live.current !== question) return { ok: false, error: "late" };
  if (!acceptsAnswer(live.questionStartedAt, live.seconds)) return { ok: false, error: "late" };
  const q = challengeQuestionsSchema.parse(live.challenge.questions)[question];
  if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) return { ok: false, error: "invalid" };
  const ms = Date.now() - live.questionStartedAt!.getTime();
  try {
    // Un élève arrivé en cours de route est inscrit au passage.
    await db.livePlayer.upsert({ where: { liveId_studentId: { liveId, studentId: role.studentId } }, update: {}, create: { liveId, studentId: role.studentId } });
    await db.liveAnswer.create({
      data: { liveId, studentId: role.studentId, question, choice, ms, points: livePoints(choice === q.answer, ms, live.seconds) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true };
    throw e;
  }
  return { ok: true };
}

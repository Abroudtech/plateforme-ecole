"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { isLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { hasClassAccess } from "@/lib/auth/scope";
import { aiEnabled, generateQuiz } from "@/lib/ai/generate";
import { aiQuotaReached } from "@/lib/ai/quota";
import { subjectLanguage } from "@/lib/ai/programme-primaire";
import { quizPrompt } from "@/lib/ai/prompt";
import { challengeQuestionsSchema, questionsFromForm, REACTIONS, scoreAnswers, type ChallengeQuestion } from "@/lib/challenges";
import { studentOf } from "@/lib/data/class-space";
import { FormError, formToObject } from "@/lib/forms";
import { isGameKey, QUESTIONS_PER_GAME, SCORED_GAMES_PER_DAY } from "@/lib/games";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

/** « manage » pour l'enseignant de la classe (ou la direction), « student » pour un élève de la classe. */
async function accessTo(ctx: Ctx, classId: string): Promise<"manage" | "student" | null> {
  if (can(ctx.roles, "classSpace.manage") && (await hasClassAccess(ctx, classId))) return "manage";
  if (can(ctx.roles, "student.space")) {
    const s = await studentOf(ctx.school.id, ctx.user.id);
    if (s?.classGroup?.id === classId) return "student";
  }
  return null;
}

async function requireManage(ctx: Ctx, classId: string) {
  if ((await accessTo(ctx, classId)) !== "manage") throw new FormError("forbidden");
}

// --- Mur de la classe ---------------------------------------------------------

export async function createPost(lang: string, classId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "classSpace.read", async (ctx) => {
    const access = await accessTo(ctx, classId);
    if (!access) throw new FormError("forbidden");
    const body = String(formData.get("body") ?? "").trim();
    if (!body || body.length > 1000) throw new FormError("invalid");
    if (access === "student") {
      // Pas plus de 5 messages en attente par élève, pour éviter les abus.
      const pending = await db.classPost.count({ where: { classGroupId: classId, authorId: ctx.user.id, status: "PENDING" } });
      if (pending >= 5) throw new FormError("tooManyPending");
    }
    await db.classPost.create({
      data: {
        schoolId: ctx.school.id,
        classGroupId: classId,
        authorId: ctx.user.id,
        body,
        status: access === "manage" ? "PUBLISHED" : "PENDING",
      },
    });
    refresh();
    return { ok: true };
  });
}

export async function reviewPost(lang: string, postId: string, approve: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classSpace.manage", async (ctx) => {
    const post = await db.classPost.findFirst({ where: { id: postId, schoolId: ctx.school.id } });
    if (!post) throw new FormError("notFound");
    await requireManage(ctx, post.classGroupId);
    await db.classPost.update({ where: { id: post.id }, data: { status: approve ? "PUBLISHED" : "REJECTED", reviewedAt: new Date() } });
    refresh();
  });
}

export async function togglePin(lang: string, postId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classSpace.manage", async (ctx) => {
    const post = await db.classPost.findFirst({ where: { id: postId, schoolId: ctx.school.id } });
    if (!post) throw new FormError("notFound");
    await requireManage(ctx, post.classGroupId);
    await db.classPost.update({ where: { id: post.id }, data: { isPinned: !post.isPinned } });
    refresh();
  });
}

export async function deletePost(lang: string, postId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classSpace.read", async (ctx) => {
    const post = await db.classPost.findFirst({ where: { id: postId, schoolId: ctx.school.id } });
    if (!post) throw new FormError("notFound");
    // L'élève peut retirer son propre message ; l'enseignant, n'importe lequel.
    const access = await accessTo(ctx, post.classGroupId);
    if (access !== "manage" && !(access === "student" && post.authorId === ctx.user.id)) throw new FormError("forbidden");
    await db.classPost.delete({ where: { id: post.id } });
    refresh();
  });
}

export async function react(lang: string, postId: string, emoji: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classSpace.read", async (ctx) => {
    if (!REACTIONS.includes(emoji)) throw new FormError("invalid");
    const post = await db.classPost.findFirst({ where: { id: postId, schoolId: ctx.school.id, status: "PUBLISHED" } });
    if (!post || !(await accessTo(ctx, post.classGroupId))) throw new FormError("forbidden");
    const key = { postId_userId: { postId: post.id, userId: ctx.user.id } };
    const existing = await db.postReaction.findUnique({ where: key });
    if (existing?.emoji === emoji) await db.postReaction.delete({ where: key });
    else await db.postReaction.upsert({ where: key, update: { emoji }, create: { postId: post.id, userId: ctx.user.id, emoji } });
    refresh();
  });
}

// --- Défis --------------------------------------------------------------------

export async function createChallenge(lang: string, classId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "classSpace.manage", async (ctx) => {
    await requireManage(ctx, classId);
    const form = formToObject(formData) as Record<string, string>;
    const title = (form.title ?? "").trim();
    if (!title || title.length > 120) throw new FormError("invalid");
    const parsed = challengeQuestionsSchema.safeParse(questionsFromForm(form));
    if (!parsed.success) throw new FormError("challengeInvalid");
    const subjectId = form.subjectId || null;
    if (subjectId && !(await db.subject.findFirst({ where: { id: subjectId, schoolId: ctx.school.id } }))) throw new FormError("invalid");
    const closesAt = form.closesAt ? new Date(`${form.closesAt}T23:59:59+01:00`) : null;
    if (closesAt && Number.isNaN(closesAt.getTime())) throw new FormError("invalid");
    await db.challenge.create({
      data: { schoolId: ctx.school.id, classGroupId: classId, authorId: ctx.user.id, subjectId, title, questions: parsed.data, closesAt },
    });
    refresh();
    return { ok: true };
  });
}

export async function deleteChallenge(lang: string, challengeId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "classSpace.manage", async (ctx) => {
    const c = await db.challenge.findFirst({ where: { id: challengeId, schoolId: ctx.school.id } });
    if (!c) throw new FormError("notFound");
    await requireManage(ctx, c.classGroupId);
    await db.challenge.delete({ where: { id: c.id } });
    refresh();
  });
}

const suggestSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  topic: z.string().trim().min(3).max(200),
  count: z.coerce.number().int().min(3).max(10),
});

/** Questions proposées par l'IA (l'enseignant les relit avant d'enregistrer). */
export async function suggestQuestions(
  rawLang: string,
  input: z.input<typeof suggestSchema>,
): Promise<{ questions: ChallengeQuestion[] } | { error: string }> {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requireContext(lang);
  if (!can(ctx.roles, "ai.use")) return { error: "forbidden" };
  if (!aiEnabled()) return { error: "aiDisabled" };
  const p = suggestSchema.safeParse(input);
  if (!p.success) return { error: "invalid" };
  if ((await accessTo(ctx, p.data.classId)) !== "manage") return { error: "forbidden" };
  const [cls, subject] = await Promise.all([
    db.classGroup.findFirst({ where: { id: p.data.classId, schoolId: ctx.school.id }, include: { gradeLevel: true } }),
    db.subject.findFirst({ where: { id: p.data.subjectId, schoolId: ctx.school.id } }),
  ]);
  if (!cls || !subject) return { error: "invalid" };
  // Les questions proposées comptent dans la limite mensuelle d'IA de l'école.
  if (await aiQuotaReached(ctx.school.id)) return { error: "aiQuota" };
  await db.aiRequest.create({ data: { schoolId: ctx.school.id, userId: ctx.user.id, kind: "challenge" } });
  const result = await generateQuiz(
    quizPrompt({
      levelFr: cls.gradeLevel.nameFr,
      levelCode: cls.gradeLevel.code,
      subjectFr: subject.nameFr,
      topic: p.data.topic,
      count: p.data.count,
      language: subjectLanguage(subject),
    }),
  );
  if (!result.ok) return { error: { refused: "aiRefused", busy: "aiBusy", unavailable: "aiUnavailable", empty: "aiUnavailable" }[result.reason] };
  return { questions: result.questions };
}

/** L'élève envoie ses réponses (une seule fois) ; on renvoie la correction. */
export async function submitChallenge(
  rawLang: string,
  challengeId: string,
  answers: (number | null)[],
): Promise<{ score: number; total: number; correct: number[] } | { error: string }> {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requireContext(lang);
  if (!can(ctx.roles, "student.space")) return { error: "forbidden" };
  const student = await studentOf(ctx.school.id, ctx.user.id);
  const c = await db.challenge.findFirst({ where: { id: challengeId, schoolId: ctx.school.id } });
  if (!student || !c || c.classGroupId !== student.classGroup?.id) return { error: "forbidden" };
  if (c.closesAt && c.closesAt < new Date()) return { error: "challengeClosed" };
  const questions = challengeQuestionsSchema.parse(c.questions);
  const clean = questions.map((_, i) => (Number.isInteger(answers[i]) ? (answers[i] as number) : null));
  const score = scoreAnswers(questions, clean);
  try {
    await db.challengeAttempt.create({
      data: { schoolId: ctx.school.id, challengeId: c.id, studentId: student.id, answers: clean, score, maxScore: questions.length },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "challengeDone" };
    throw e;
  }
  return { score, total: questions.length, correct: questions.map((q) => q.answer) };
}

// --- Jeux ---------------------------------------------------------------------

/** Enregistre une partie ; au-delà de 5 parties par jour et par jeu, elle ne rapporte plus de points. */
export async function saveGame(rawLang: string, game: string, score: number): Promise<{ counted: boolean } | { error: string }> {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requireContext(lang);
  if (!can(ctx.roles, "student.space") || !isGameKey(game)) return { error: "forbidden" };
  if (!Number.isInteger(score) || score < 0 || score > QUESTIONS_PER_GAME) return { error: "invalid" };
  const student = await studentOf(ctx.school.id, ctx.user.id);
  if (!student?.classGroup) return { error: "forbidden" };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const played = await db.gameScore.count({ where: { studentId: student.id, game, createdAt: { gte: since } } });
  if (played >= SCORED_GAMES_PER_DAY) return { counted: false };
  await db.gameScore.create({
    data: { schoolId: ctx.school.id, studentId: student.id, classGroupId: student.classGroup.id, game, score },
  });
  return { counted: true };
}

import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { hasClassAccess } from "@/lib/auth/scope";
import { challengeQuestionsSchema } from "@/lib/challenges";
import { studentOf } from "@/lib/data/class-space";
import { db } from "@/lib/db";
import { liveRanking, remainingSeconds, type LivePhase } from "@/lib/live";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };

/** Un défi en direct qui n'a pas commencé depuis plus de 3 heures est considéré terminé. */
const MAX_AGE_MS = 3 * 3600_000;

/** Défi en direct en cours pour une classe (ou null). */
export function activeLive(schoolId: string, classGroupId: string) {
  return db.liveQuiz.findFirst({
    where: { schoolId, classGroupId, phase: { not: "DONE" }, createdAt: { gt: new Date(Date.now() - MAX_AGE_MS) } },
    include: { challenge: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Qui regarde : l'enseignant de la classe (« host ») ou un élève de la classe. */
export async function liveRole(ctx: Ctx, live: { schoolId: string; classGroupId: string }) {
  if (live.schoolId !== ctx.school.id) return null;
  if (can(ctx.roles, "classSpace.manage") && (await hasClassAccess(ctx, live.classGroupId))) return { kind: "host" as const };
  if (can(ctx.roles, "student.space")) {
    const s = await studentOf(ctx.school.id, ctx.user.id);
    if (s?.classGroup?.id === live.classGroupId) return { kind: "player" as const, studentId: s.id };
  }
  return null;
}

type Name = { firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null };
const short = (s: Name, lang: string) => {
  const first = lang === "ar" && s.firstNameAr ? s.firstNameAr : s.firstName;
  const last = lang === "ar" && s.lastNameAr ? s.lastNameAr : s.lastName;
  return `${first} ${last.slice(0, 1)}.`;
};

/**
 * État du défi en direct envoyé à l'écran (enseignant) ou au téléphone (élève).
 * La bonne réponse n'est envoyée qu'une fois la question terminée.
 */
export async function liveState(ctx: Ctx, liveId: string, lang: string) {
  const live = await db.liveQuiz.findFirst({
    where: { id: liveId, schoolId: ctx.school.id },
    include: {
      challenge: true,
      players: { include: { student: true }, orderBy: { joinedAt: "asc" } },
      answers: { select: { studentId: true, question: true, choice: true, points: true } },
    },
  });
  if (!live) return null;
  const role = await liveRole(ctx, live);
  if (!role) return null;

  const questions = challengeQuestionsSchema.parse(live.challenge.questions);
  const phase = live.phase as LivePhase;
  const q = questions[live.current];
  const showQuestion = phase === "QUESTION" || phase === "REVEAL";
  const revealed = phase === "REVEAL" || phase === "DONE";
  const current = live.answers.filter((a) => a.question === live.current);
  const ranking = liveRanking(
    live.players.map((p) => ({ studentId: p.studentId, name: short(p.student, lang) })),
    live.answers,
  );
  const me = role.kind === "player" ? role.studentId : null;
  const mine = me ? current.find((a) => a.studentId === me) : undefined;
  const myRow = me ? ranking.find((r) => r.studentId === me) : undefined;

  return {
    id: live.id,
    role: role.kind,
    title: live.challenge.title,
    phase,
    current: live.current,
    total: questions.length,
    seconds: live.seconds,
    remaining: phase === "QUESTION" ? remainingSeconds(live.questionStartedAt, live.seconds) : 0,
    question: showQuestion && q ? { q: q.q, choices: q.choices } : null,
    answer: revealed && phase === "REVEAL" && q ? q.answer : null,
    counts: phase === "REVEAL" && q ? q.choices.map((_, i) => current.filter((a) => a.choice === i).length) : null,
    answered: current.length,
    players: live.players.length,
    names: phase === "LOBBY" ? live.players.map((p) => short(p.student, lang)) : [],
    ranking: phase === "QUESTION" ? [] : ranking.slice(0, phase === "DONE" ? 10 : 5).map(({ name, points, rank, correct }) => ({ name, points, rank, correct })),
    me: me
      ? {
          joined: live.players.some((p) => p.studentId === me),
          choice: mine?.choice ?? null,
          lastPoints: phase === "REVEAL" ? mine?.points ?? 0 : null,
          total: myRow?.points ?? 0,
          rank: myRow?.rank ?? null,
          correct: myRow?.correct ?? 0,
        }
      : null,
  };
}

export type LiveState = NonNullable<Awaited<ReturnType<typeof liveState>>>;

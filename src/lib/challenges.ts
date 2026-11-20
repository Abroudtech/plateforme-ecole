import { z } from "zod";

/** Une question de défi : énoncé, 2 à 4 choix, index de la bonne réponse. */
export const challengeQuestionSchema = z
  .object({
    q: z.string().trim().min(1).max(300),
    choices: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
    answer: z.number().int().min(0),
  })
  .refine((x) => x.answer < x.choices.length, { message: "answer" });

export const challengeQuestionsSchema = z.array(challengeQuestionSchema).min(1).max(20);
export type ChallengeQuestion = z.infer<typeof challengeQuestionSchema>;

/** Réactions possibles sur le mur de la classe : pas de texte libre entre élèves. */
export const REACTIONS = ["👍", "❤️", "👏", "🌟", "😮"];

/** Points gagnés par bonne réponse à un défi (un jeu rapporte 1 point). */
export const POINTS_PER_CHALLENGE_ANSWER = 2;

/**
 * Lit les questions envoyées par le formulaire de création :
 * q0, c0_0..c0_3, a0, puis q1... Les lignes vides sont ignorées.
 */
export function questionsFromForm(form: Record<string, string>): ChallengeQuestion[] {
  const out: ChallengeQuestion[] = [];
  for (let i = 0; i < 20; i++) {
    const q = (form[`q${i}`] ?? "").trim();
    if (!q) continue;
    const raw = [0, 1, 2, 3].map((j) => (form[`c${i}_${j}`] ?? "").trim());
    const answerRaw = Number(form[`a${i}`] ?? 0);
    // On garde les choix remplis, en suivant où se trouve la bonne réponse.
    const kept = raw.map((text, j) => ({ text, j })).filter((c) => c.text);
    const answer = kept.findIndex((c) => c.j === answerRaw);
    out.push({ q, choices: kept.map((c) => c.text), answer });
  }
  return out;
}

/** Nombre de bonnes réponses. Les réponses manquantes comptent comme fausses. */
export function scoreAnswers(questions: ChallengeQuestion[], answers: (number | null)[]): number {
  return questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
}

/** Classement : rang partagé en cas d'égalité (1, 2, 2, 4...). */
export function rankRows<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.points < sorted[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

import { describe, expect, it } from "vitest";
import { challengeQuestionsSchema, questionsFromForm, rankRows, scoreAnswers } from "@/lib/challenges";
import { GAME_KEYS, levelNumber, makeQuestions, seeded } from "@/lib/games";
import { looksLikeUsername, studentUsername } from "@/lib/student/username";

describe("identifiant élève", () => {
  it("prénom sans accents + matricule", () => {
    expect(studentUsername("Yasmine", "2026-001")).toBe("yasmine.2026001");
    expect(studentUsername("Élyès", "2026-014")).toBe("elyes.2026014");
    expect(studentUsername("ياسمين", "2026-002")).toBe("eleve.2026002");
    expect(studentUsername("Adam", "2026-003", 1)).toBe("adam.2026003-2");
  });
  it("se distingue d'un téléphone ou d'un e-mail", () => {
    expect(looksLikeUsername("yasmine.2026001")).toBe(true);
    expect(looksLikeUsername("Adam.2026003-2")).toBe(true);
    expect(looksLikeUsername("22 123 456")).toBe(false);
    expect(looksLikeUsername("a@b.tn")).toBe(false);
  });
});

describe("défis", () => {
  it("lit le formulaire en ignorant les lignes et réponses vides", () => {
    const qs = questionsFromForm({
      q0: "3 + 4 ?", c0_0: "6", c0_1: "", c0_2: "7", c0_3: "8", a0: "2",
      q1: "", c1_0: "x",
      q2: "Capitale ?", c2_0: "Tunis", c2_1: "Sfax", a2: "0",
    });
    expect(qs).toEqual([
      { q: "3 + 4 ?", choices: ["6", "7", "8"], answer: 1 },
      { q: "Capitale ?", choices: ["Tunis", "Sfax"], answer: 0 },
    ]);
    expect(challengeQuestionsSchema.safeParse(qs).success).toBe(true);
    // Bonne réponse cochée sur une case vide : refusé.
    const bad = questionsFromForm({ q0: "?", c0_0: "a", c0_1: "b", a0: "3" });
    expect(challengeQuestionsSchema.safeParse(bad).success).toBe(false);
  });
  it("compte les bonnes réponses et classe avec ex æquo", () => {
    const qs = [{ q: "a", choices: ["1", "2"], answer: 1 }, { q: "b", choices: ["1", "2"], answer: 0 }];
    expect(scoreAnswers(qs, [1, 0])).toBe(2);
    expect(scoreAnswers(qs, [1])).toBe(1);
    expect(rankRows([{ id: "a", points: 5 }, { id: "b", points: 9 }, { id: "c", points: 5 }, { id: "d", points: 1 }]).map((r) => [r.id, r.rank])).toEqual([
      ["b", 1], ["a", 2], ["c", 2], ["d", 4],
    ]);
  });
});

describe("jeux", () => {
  it("fabrique 10 questions justes pour chaque jeu et chaque niveau", () => {
    for (const game of GAME_KEYS) {
      for (let level = 1; level <= 6; level++) {
        const qs = makeQuestions(game, level, seeded(level * 31 + game.length));
        expect(qs).toHaveLength(10);
        for (const q of qs) {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(new Set(q.choices).size).toBe(q.choices.length);
          if (game === "calcul" || game === "tables") {
            const [a, op, b] = q.prompt.split(" ");
            const r = { "+": +a + +b, "-": +a - +b, "×": +a * +b, "÷": +a / +b }[op]!;
            expect(Number(q.choices[q.answer])).toBe(r);
            expect(Number.isInteger(r) && r >= 0).toBe(true);
          }
        }
      }
    }
  });
  it("adapte la difficulté du calcul au niveau", () => {
    const max = (level: number) => Math.max(...makeQuestions("calcul", level, seeded(7)).map((q) => Number(q.choices[q.answer])));
    expect(max(1)).toBeLessThanOrEqual(20);
    expect(levelNumber("P3")).toBe(3);
    expect(levelNumber("PREP")).toBe(1);
  });
  it("la lettre cachée fait bien partie du mot", () => {
    for (const q of makeQuestions("lettres", 2, seeded(3))) {
      expect(q.prompt).toContain("؟");
      expect(q.choices).toHaveLength(3);
    }
  });
});

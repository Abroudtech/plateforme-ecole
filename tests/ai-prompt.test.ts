import { describe, expect, it } from "vitest";
import { subjectLanguage } from "@/lib/ai/programme-primaire";
import { extractTitle, resourceRequestSchema, systemPrompt, userPrompt, type PromptInput } from "@/lib/ai/prompt";

const base = (over: Partial<PromptInput> = {}): PromptInput => ({
  ...resourceRequestSchema.parse({ kind: "EXAM", gradeLevelId: "l", subjectId: "s", topic: "Les fractions" }),
  level: { code: "P5", nameFr: "5e année", nameAr: "السنة الخامسة" },
  subject: { nameFr: "Mathématiques", nameAr: "الرياضيات" },
  language: "ar",
  schoolName: "La plume d'or",
  ...over,
});

describe("atelier IA : consignes", () => {
  it("choisit la langue selon la matière", () => {
    expect(subjectLanguage({ code: "MATH", nameFr: "Mathématiques" })).toBe("ar");
    expect(subjectLanguage({ code: "FR", nameFr: "Français" })).toBe("fr");
    expect(subjectLanguage({ code: "X1", nameFr: "français (oral)" })).toBe("fr");
    expect(subjectLanguage({ code: "EN", nameFr: "Anglais" })).toBe("en");
    expect(subjectLanguage({ code: "EVEIL", nameFr: "Éveil scientifique" })).toBe("ar");
  });

  it("valide la demande et applique les valeurs par défaut", () => {
    const r = resourceRequestSchema.parse({ kind: "LESSON", gradeLevelId: "a", subjectId: "b", topic: "  La lettre ب  " });
    expect(r).toMatchObject({ topic: "La lettre ب", term: "1", duration: 45, difficulty: "medium", count: 6, instructions: "" });
    expect(resourceRequestSchema.safeParse({ kind: "POEM", gradeLevelId: "a", subjectId: "b", topic: "abc" }).success).toBe(false);
    expect(resourceRequestSchema.safeParse({ kind: "EXAM", gradeLevelId: "a", subjectId: "b", topic: "x" }).success).toBe(false);
  });

  it("décrit un examen par critères, avec niveau, thème et langue", () => {
    const p = userPrompt(base({ instructions: "Pas de calculatrice" }));
    expect(p).toContain("5e année");
    expect(p).toContain("Les fractions");
    expect(p).toContain("C1, C2, C3");
    expect(p).toContain("arabe standard");
    expect(p).toContain("Pas de calculatrice");
    expect(p).toContain("Repère de niveau");
  });

  it("adapte la tâche au type de document", () => {
    expect(userPrompt(base({ kind: "LESSON", duration: 50 }))).toContain("50 minutes");
    expect(userPrompt(base({ kind: "EXERCISES", count: 8, language: "fr" }))).toMatch(/8 exercices[\s\S]*en français/);
    expect(systemPrompt()).toContain("primaire tunisien");
  });

  it("reprend le premier titre du document", () => {
    expect(extractTitle("Intro\n# **Fiche** : les fractions\n## Objectifs", "x")).toBe("Fiche : les fractions");
    expect(extractTitle("pas de titre", "Les fractions")).toBe("Les fractions");
  });
});

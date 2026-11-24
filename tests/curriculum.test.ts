import { describe, expect, it } from "vitest";
import { PROGRAMME } from "@/lib/curriculum/data";
import {
  PROGRAMME_LEVELS,
  findLesson,
  lessonContext,
  lessonsOf,
  previousLesson,
  programmeSubjectFor,
  programmeSubjects,
  subjectProgramme,
} from "@/lib/curriculum";
import { resourceRequestSchema, userPrompt, type PromptInput } from "@/lib/ai/prompt";

describe("référentiel du programme du primaire", () => {
  it("couvre la 1re à la 6e année avec les matières principales", () => {
    for (const level of PROGRAMME_LEVELS) {
      expect(programmeSubjects(level)).toEqual(expect.arrayContaining(["AR", "MATH", "EVEIL", "ISL"]));
    }
    expect(programmeSubjects("P1")).not.toContain("FR");
    expect(programmeSubjects("P5")).toContain("HG");
    expect(programmeSubjects("C7")).toEqual([]);
  });

  it("a des leçons complètes : trimestre valide, intitulés en français et en arabe, sans doublon", () => {
    for (const level of PROGRAMME_LEVELS) {
      for (const subject of Object.keys(PROGRAMME[level])) {
        const lessons = lessonsOf(level, subject);
        expect(lessons.length).toBeGreaterThanOrEqual(3);
        const titles = new Set<string>();
        for (const l of lessons) {
          expect([1, 2, 3]).toContain(l.term);
          expect(l.fr.length).toBeGreaterThan(2);
          expect(l.ar.length).toBeGreaterThan(2);
          expect(titles.has(l.fr)).toBe(false);
          titles.add(l.fr);
        }
        // Chaque trimestre a au moins une leçon.
        expect(new Set(lessons.map((l) => l.term)).size).toBe(3);
        const view = subjectProgramme(level, subject)!;
        expect(view.competence.fr.length).toBeGreaterThan(10);
      }
    }
  });

  it("retrouve une leçon par son identifiant et sa leçon précédente", () => {
    const lessons = lessonsOf("P5", "MATH");
    const second = lessons[1];
    expect(findLesson(second.id)).toEqual(second);
    expect(previousLesson(second)?.id).toBe(lessons[0].id);
    expect(previousLesson(lessons[0])).toBeNull();
    expect(findLesson("P9-MATH-1")).toBeNull();
    expect(findLesson("n'importe quoi")).toBeNull();
  });

  it("relie les matières de l'école au référentiel, par code ou par nom", () => {
    expect(programmeSubjectFor({ code: "MATH", nameFr: "Mathématiques" })).toBe("MATH");
    expect(programmeSubjectFor({ code: null, nameFr: "Langue arabe" })).toBe("AR");
    expect(programmeSubjectFor({ code: "X", nameFr: "Éveil scientifique" })).toBe("EVEIL");
    expect(programmeSubjectFor({ code: "", nameFr: "Histoire et géographie" })).toBe("HG");
    expect(programmeSubjectFor({ code: "ART", nameFr: "Éducation artistique" })).toBeNull();
  });

  it("ajoute les repères du programme à la demande faite à l'IA", () => {
    const lesson = lessonsOf("P5", "MATH").find((l) => l.fr.startsWith("Addition et soustraction de fractions"))!;
    const ctx = lessonContext(lesson);
    expect(ctx).toContain("Nombres et calcul");
    expect(ctx).toContain("جمع الكسور وطرحها");
    expect(ctx).toContain("Les fractions équivalentes");
    expect(ctx).toContain("Ne recopie aucun texte de manuel");

    const input: PromptInput = {
      ...resourceRequestSchema.parse({ kind: "LESSON", gradeLevelId: "l", subjectId: "s", topic: lesson.fr, lessonId: lesson.id }),
      level: { code: "P5", nameFr: "5e année", nameAr: "السنة الخامسة" },
      subject: { nameFr: "Mathématiques", nameAr: "الرياضيات" },
      language: "ar",
      schoolName: "École test",
      programme: ctx,
    };
    expect(userPrompt(input)).toContain("Repère du programme officiel");
    expect(userPrompt({ ...input, programme: undefined })).not.toContain("Repère du programme officiel");
  });
});

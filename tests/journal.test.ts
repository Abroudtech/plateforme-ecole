import { describe, expect, it } from "vitest";
import { findLesson } from "@/lib/curriculum";
import { addDays, cleanSkills, contentLang, fieldOf, isoWeekday, mondayOf, parseRows, rowFromLesson, rowsFromTimetable, schoolWeek } from "@/lib/journal";

describe("journal de classe", () => {
  it("garde seulement les compétences de vie connues, dans l'ordre du cahier", () => {
    expect(cleanSkills(["communication", "inconnue", "creativity", "communication"])).toEqual(["creativity", "communication"]);
  });

  it("retire les lignes vides et nettoie les valeurs envoyées", () => {
    const rows = parseRows([
      { activity: "حساب", duration: "45", content: "الأعداد 2-4-5", subjectId: "" },
      { activity: "", content: "  " },
      { goal: "x".repeat(2000), duration: "abc" },
      "n'importe quoi",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ activity: "حساب", duration: 45, content: "الأعداد 2-4-5", subjectId: null, lessonId: null });
    expect(parseRows("pas une liste")).toEqual([]);
  });

  it("classe chaque matière dans son domaine, dans la langue de l'activité", () => {
    expect(fieldOf("MATH", "ar")).toBe("العلوم والتكنولوجيا");
    expect(fieldOf("ISL", "ar")).toBe("التنشئة الاجتماعية");
    expect(fieldOf("FR", "fr")).toBe("Langues étrangères");
    expect(contentLang("FR", "ar")).toBe("fr");
    expect(contentLang("MATH", "fr")).toBe("ar");
    expect(contentLang(null, "fr")).toBe("fr");
  });

  it("remplit la ligne depuis une leçon du programme officiel", () => {
    const lesson = findLesson("P2-MATH-1")!;
    const row = rowFromLesson(lesson, "fr");
    expect(row.lessonId).toBe("P2-MATH-1");
    expect(row.content).toBe(lesson.ar);
    expect(row.competence).toBe(lesson.domain.ar);
    expect(row.field).toBe("العلوم والتكنولوجيا");
  });

  it("propose les activités de la journée depuis l'emploi du temps", () => {
    const draft = rowsFromTimetable(
      [
        { subjectId: "b", startMinute: 600, endMinute: 660, subject: { nameFr: "Éducation islamique", nameAr: "التربية الإسلامية" }, programme: "ISL" },
        { subjectId: "a", startMinute: 480, endMinute: 525, subject: { nameFr: "Mathématiques", nameAr: "الرياضيات" }, programme: "MATH" },
      ],
      "fr",
    );
    expect(draft.startMinute).toBe(480);
    expect(draft.endMinute).toBe(660);
    expect(draft.rows.map((r) => [r.activity, r.duration])).toEqual([["الرياضيات", 45], ["التربية الإسلامية", 60]]);
    expect(rowsFromTimetable([], "ar")).toEqual({ rows: [], startMinute: null, endMinute: null });
  });

  it("calcule la semaine de classe (lundi à samedi)", () => {
    expect(mondayOf("2026-11-26")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23"); // dimanche
    expect(schoolWeek("2026-11-23")).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoWeekday("2026-11-16")).toBe(1);
  });
});

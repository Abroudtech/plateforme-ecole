import { describe, expect, it } from "vitest";
import { mapColumns, normalizeKey, parseDate, parseGender, parseRelationship, parseWorkbook, type Cell } from "@/lib/import/parse";
import { planImport, type Snapshot } from "@/lib/import/plan";
import { SHEETS, sheetDef, sheetTabName } from "@/lib/import/schema";

const header = (key: (typeof SHEETS)[number]["key"]) => sheetDef(key).columns.map((c) => `${c.fr}${c.required ? " *" : ""}\n${c.ar}`);
const tab = (key: (typeof SHEETS)[number]["key"]) => sheetTabName(sheetDef(key));

function snapshot(partial: Partial<Snapshot> = {}): Snapshot {
  return {
    yearId: "y1",
    yearPrefix: "2026",
    levels: [
      { id: "lp1", code: "P1", nameFr: "1re année", nameAr: "السنة الأولى", cycle: "PRIMARY" },
      { id: "lp2", code: "P2", nameFr: "2e année", nameAr: "السنة الثانية", cycle: "PRIMARY" },
    ],
    tracks: [],
    classes: [],
    subjects: [{ id: "sar", code: "AR", nameFr: "Arabe", nameAr: "العربية" }],
    curriculum: [{ id: "cur1", gradeLevelId: "lp1", trackId: null, subjectId: "sar", coefficient: 2 }],
    rooms: [],
    teachers: [],
    students: [],
    guardians: [],
    studentNumbers: [],
    ...partial,
  };
}

let n = 0;
const newId = () => `id${++n}`;

describe("lecture des valeurs", () => {
  it("normalise les textes saisis à la main", () => {
    expect(normalizeKey("1ère Année")).toBe(normalizeKey("1re année"));
    expect(normalizeKey("  2ème   année ")).toBe("2 annee");
    expect(normalizeKey("السنة الأولى")).toBe(normalizeKey("السنة الاولى"));
  });

  it("lit les dates sous plusieurs formes", () => {
    expect(parseDate("15/03/2019")).toBe("2019-03-15");
    expect(parseDate("5-3-2019")).toBe("2019-03-05");
    expect(parseDate("2019-03-15")).toBe("2019-03-15");
    expect(parseDate(new Date(Date.UTC(2019, 2, 15)))).toBe("2019-03-15");
    expect(parseDate(43539)).toBe("2019-03-15"); // numéro de série Excel
    expect(parseDate("31/02/2019")).toBe("invalid");
    expect(parseDate("demain")).toBe("invalid");
    expect(parseDate("")).toBeNull();
  });

  it("comprend le sexe et le lien de parenté en français et en arabe", () => {
    expect(parseGender("G")).toBe("MALE");
    expect(parseGender("fille")).toBe("FEMALE");
    expect(parseGender("أنثى")).toBe("FEMALE");
    expect(parseGender("X")).toBe("invalid");
    expect(parseRelationship("Mère")).toBe("MOTHER");
    expect(parseRelationship("الأب")).toBe("FATHER");
    expect(parseRelationship("")).toBeNull();
  });

  it("retrouve les colonnes par leur titre, même déplacées", () => {
    const def = sheetDef("rooms");
    expect(mapColumns(def, ["Places", "Nom de la salle *"])).toEqual({ capacity: 0, name: 1 });
    expect(mapColumns(def, ["", ""])).toEqual({ name: 0, capacity: 1 });
  });
});

describe("préparation de l'import", () => {
  it("crée classes, élèves et parents, en reliant frères et sœurs au même parent", () => {
    const book = parseWorkbook([
      { name: tab("classes"), rows: [header("classes"), ["1A", null, "1ère année"], ["2A", "2أ", "P2"]] },
      {
        name: tab("students"),
        rows: [
          header("students"),
          [null, "Ben Salah", "Yasmine", null, null, "F", "15/03/2019", "Moknine", "1A", "Père", "Ben Salah", "Karim", "22 123 456"],
          [null, "Ben Salah", "Adam", null, null, "G", "02/01/2018", null, "2A", "Père", null, "Karim", "22123456", null, "Mère", "Trabelsi", "Sonia", "98 765 432"],
        ] as Cell[][],
      },
    ]);
    const plan = planImport(book, snapshot(), newId);
    expect(plan.counts.classes).toEqual({ create: 2, update: 0, exists: 0, error: 0 });
    expect(plan.counts.students).toEqual({ create: 2, update: 0, exists: 0, error: 0 });
    expect(plan.students.map((s) => s.studentNumber)).toEqual(["2026-001", "2026-002"]);
    expect(plan.enrollments).toHaveLength(2);
    // Karim n'est créé qu'une fois ; Sonia en plus.
    expect(plan.guardians.map((g) => g.firstName)).toEqual(["Karim", "Sonia"]);
    expect(plan.guardians[0].phone).toBe("+21622123456");
    expect(plan.links.filter((l) => l.isPrimary)).toHaveLength(2);
  });

  it("ne crée rien en double quand on renvoie le même fichier", () => {
    const book = parseWorkbook([
      { name: tab("classes"), rows: [header("classes"), ["1A", null, "1re année"]] },
      { name: tab("teachers"), rows: [header("teachers"), ["Mabrouk", "Leila", null, null, "55 111 222"]] },
      {
        name: tab("students"),
        rows: [header("students"), ["2026-001", "Ben Salah", "Yasmine", null, null, "F", "15/03/2019", null, "1A", "Mère", "Trabelsi", "Sonia", "98765432"]] as Cell[][],
      },
    ]);
    const plan = planImport(
      book,
      snapshot({
        classes: [{ id: "c1", name: "1A", nameAr: null, gradeLevelId: "lp1", trackId: null }],
        teachers: [{ id: "t1", firstName: "Leïla", lastName: "MABROUK", phone: null, email: null }],
        students: [{ id: "s1", studentNumber: "2026-001", firstName: "Yasmine", lastName: "Ben Salah", birthDate: "2019-03-15", classId: "c1", guardianIds: ["g1"], hasPrimary: true }],
        guardians: [{ id: "g1", firstName: "Sonia", lastName: "Trabelsi", phone: "+21698765432", email: null }],
        studentNumbers: ["2026-001"],
      }),
      newId,
    );
    expect(plan.counts.classes.exists).toBe(1);
    expect(plan.counts.teachers.exists).toBe(1);
    expect(plan.counts.students.exists).toBe(1);
    expect(plan.classes.length + plan.teachers.length + plan.students.length + plan.guardians.length + plan.links.length).toBe(0);
  });

  it("complète un élève existant : inscription et nouveau parent", () => {
    const book = parseWorkbook([
      {
        name: tab("students"),
        rows: [header("students"), [null, "ben salah", "yasmine", null, null, null, null, null, "1A", "Père", null, "Karim", "22123456"]] as Cell[][],
      },
    ]);
    const plan = planImport(
      book,
      snapshot({
        classes: [{ id: "c1", name: "1A", nameAr: null, gradeLevelId: "lp1", trackId: null }],
        students: [{ id: "s1", studentNumber: "2025-010", firstName: "Yasmine", lastName: "Ben Salah", birthDate: "2019-03-15", classId: null, guardianIds: [], hasPrimary: false }],
      }),
      newId,
    );
    expect(plan.counts.students.update).toBe(1);
    expect(plan.enrollments).toEqual([{ studentId: "s1", classGroupId: "c1" }]);
    expect(plan.links).toEqual([expect.objectContaining({ studentId: "s1", relationship: "FATHER", isPrimary: true })]);
  });

  it("signale les erreurs ligne par ligne sans bloquer les autres lignes", () => {
    const book = parseWorkbook([
      { name: tab("classes"), rows: [header("classes"), ["1A", null, "9e année"], ["1B", null, "1re année"], ["1B", null, "1re année"]] },
      {
        name: tab("students"),
        rows: [
          header("students"),
          [null, "Ben Salah", null],
          [null, "Ben Salah", "Adam", null, null, "Z", "32/01/2018", null, "3C", null, null, null, "123"],
          [null, "Ben Salah", "Ali", null, null, null, null, null, "1B"],
        ] as Cell[][],
      },
    ]);
    const plan = planImport(book, snapshot(), newId);
    const errors = plan.rows.filter((r) => r.status === "error");
    expect(errors.map((r) => [r.sheet, r.row])).toEqual([
      ["classes", 2],
      ["classes", 4],
      ["students", 2],
      ["students", 3],
    ]);
    expect(errors[0].issues[0].key).toBe("levelUnknown");
    expect(errors[1].issues[0].key).toBe("duplicateInFile");
    expect(errors[3].issues.map((i) => i.key)).toEqual(["phoneInvalid", "parentNameMissing", "genderInvalid", "dateInvalid"]);
    expect(plan.students.map((s) => s.firstName)).toEqual(["Ali"]);
  });

  it("met à jour un coefficient et ajoute une nouvelle matière", () => {
    const book = parseWorkbook([
      { name: tab("subjects"), rows: [header("subjects"), ["1re année", "Arabe", null, 3], ["1re année", "Musique", "الموسيقى", "1,5"]] as Cell[][] },
    ]);
    const plan = planImport(book, snapshot(), newId);
    expect(plan.curriculumUpdate).toEqual([{ id: "cur1", coefficient: 3 }]);
    expect(plan.subjects).toEqual([expect.objectContaining({ code: "MUSIQU", nameFr: "Musique", nameAr: "الموسيقى" })]);
    expect(plan.curriculumCreate[0].coefficient).toBe(1.5);
  });
});

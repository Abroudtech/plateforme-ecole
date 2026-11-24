import { describe, expect, it } from "vitest";
import { addDays, busyDays, examStats, groupAgenda, mondayOf, termForDate } from "@/lib/calendar";

describe("calendrier", () => {
  it("trouve le lundi de la semaine", () => {
    expect(mondayOf("2026-11-24")).toBe("2026-11-23"); // mardi
    expect(mondayOf("2026-11-29")).toBe("2026-11-23"); // dimanche
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("regroupe par semaine et par jour, vacances en cours comprises", () => {
    const weeks = groupAgenda(
      [
        { key: "a", kind: "exam", date: "2026-11-27", title: "Maths" },
        { key: "b", kind: "event", date: "2026-11-20", endDate: "2026-11-25", title: "Vacances" },
        { key: "c", kind: "homework", date: "2026-11-27", title: "Exos" },
        { key: "d", kind: "exam", date: "2026-12-01", title: "Arabe" },
        { key: "e", kind: "exam", date: "2026-11-10", title: "Passé" },
      ],
      "2026-11-24",
    );
    expect(weeks.map((w) => w.monday)).toEqual(["2026-11-23", "2026-11-30"]);
    expect(weeks[0].days.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-27"]);
    expect(weeks[0].days[1].items.map((i) => i.key)).toEqual(["a", "c"]);
  });

  it("signale les journées chargées d'une classe", () => {
    const busy = busyDays([
      { classGroupId: "6A", date: "2026-12-01" },
      { classGroupId: "6A", date: "2026-12-01" },
      { classGroupId: "7B", date: "2026-12-01" },
    ]);
    expect([...busy]).toEqual([["6A|2026-12-01", 2]]);
  });

  it("place l'examen dans le bon trimestre", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const terms = [
      { order: 1, startDate: d("2026-09-15"), endDate: d("2026-12-31") },
      { order: 2, startDate: d("2027-01-01"), endDate: d("2027-03-15") },
    ];
    expect(termForDate(terms, "2026-11-27")?.order).toBe(1);
    expect(termForDate(terms, "2027-02-01")?.order).toBe(2);
    expect(termForDate(terms, "2027-05-01")?.order).toBe(2);
  });

  it("résume les notes d'un examen", () => {
    const s = examStats([8, 12, 16, null, 4], 20)!;
    expect(s.count).toBe(4);
    expect(s.mean).toBe(10);
    expect(s.below).toBe(2);
    expect(s.buckets).toEqual([1, 1, 1, 1]);
    expect(examStats([null])).toBeNull();
  });
});

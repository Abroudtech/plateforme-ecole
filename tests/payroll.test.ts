import { describe, expect, it } from "vitest";
import { parseMonth, teachingMinutes, weekdayCounts } from "@/lib/payroll";

describe("heures de cours du mois", () => {
  it("compte les jours de la semaine d'un mois", () => {
    // Novembre 2026 : commence un dimanche, 30 jours.
    const c = weekdayCounts(2026, 11);
    expect(c[7]).toBe(5);
    expect(c[1]).toBe(5);
    expect(c[2]).toBe(4);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(30);
  });

  it("multiplie chaque créneau par le nombre de fois où son jour revient", () => {
    const c = weekdayCounts(2026, 11);
    const r = teachingMinutes(
      [
        { dayOfWeek: 1, startMinute: 480, endMinute: 540 }, // lundi 1 h
        { dayOfWeek: 2, startMinute: 600, endMinute: 690 }, // mardi 1 h 30
      ],
      c,
    );
    expect(r.week).toBe(150);
    expect(r.month).toBe(60 * 5 + 90 * 4);
  });

  it("lit le mois choisi", () => {
    expect(parseMonth("2026-02")).toEqual({ year: 2026, month: 2 });
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("x")).toBeNull();
  });
});

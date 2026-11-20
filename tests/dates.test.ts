import { describe, expect, it } from "vitest";
import { currentPeriod, parseISODate, todayISO } from "@/lib/dates";

describe("dates", () => {
  it("donne la date du jour à l'heure de Tunis", () => {
    // 23h30 UTC le 19 = 00h30 le 20 à Tunis (UTC+1)
    expect(todayISO(new Date("2026-11-19T23:30:00Z"))).toBe("2026-11-20");
  });
  it("refuse les dates invalides", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("abc")).toBeNull();
    expect(parseISODate("2026-11-20")?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });
  it("distingue matin et après-midi", () => {
    expect(currentPeriod(new Date("2026-11-20T08:00:00Z"))).toBe("MORNING"); // 9h Tunis
    expect(currentPeriod(new Date("2026-11-20T13:00:00Z"))).toBe("AFTERNOON"); // 14h Tunis
  });
});

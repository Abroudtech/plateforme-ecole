import { describe, expect, it } from "vitest";
import { nextYearLabel, plusOneYear, proposeDestination, sectionOf } from "@/lib/rollover";

const next = [
  { id: "6A", name: "6A", rank: 6, trackId: null },
  { id: "7B1", name: "7B1", rank: 7, trackId: null },
  { id: "7A", name: "7A", rank: 7, trackId: null },
  { id: "3M1", name: "3M1", rank: 12, trackId: "math" },
  { id: "3S1", name: "3S1", rank: 12, trackId: "sc" },
];

describe("passage à l'année suivante", () => {
  it("libellé et dates", () => {
    expect(nextYearLabel("2026-2027")).toBe("2027-2028");
    expect(plusOneYear(new Date("2026-09-15T00:00:00Z")).toISOString().slice(0, 10)).toBe("2027-09-15");
    expect(sectionOf("9B1")).toBe("B1");
  });
  it("admis : niveau suivant, même section si possible", () => {
    expect(proposeDestination({ name: "6A", rank: 6, trackId: null }, "PASS", next, 13)).toBe("7A");
    expect(proposeDestination({ name: "6C", rank: 6, trackId: null }, "PASS", next, 13)).toBe("7A");
  });
  it("admis au lycée : même filière", () => {
    expect(proposeDestination({ name: "2S1", rank: 11, trackId: "sc" }, "PASS", next, 13)).toBe("3S1");
  });
  it("non admis : même classe", () => {
    expect(proposeDestination({ name: "6A", rank: 6, trackId: null }, "FAIL", next, 13)).toBe("6A");
  });
  it("dernier niveau de l'école : quitte l'école", () => {
    expect(proposeDestination({ name: "6A", rank: 6, trackId: null }, "PASS", next, 6)).toBe("LEAVE");
  });
  it("en attente : à choisir", () => {
    expect(proposeDestination({ name: "6A", rank: 6, trackId: null }, "PENDING", next, 13)).toBeNull();
  });
});

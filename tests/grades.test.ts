import { describe, expect, it } from "vitest";
import { generalAverage, ranks, round2, stats, subjectAverage } from "@/lib/grades/compute";

const n = (score: number | null, maxScore = 20, weight = 1, absent = false) => ({ score, maxScore, weight, absent });

describe("moyenne d'une matière", () => {
  it("ramène les notes sur 20 et applique les poids", () => {
    // 8/10 = 16/20 (poids 1) ; 10/20 (poids 2) → (16 + 20) / 3 = 12
    expect(subjectAverage([n(8, 10), n(10, 20, 2)])).toBe(12);
  });
  it("ignore les absences et les notes non saisies", () => {
    expect(subjectAverage([n(14), n(null, 20, 1, true), n(null)])).toBe(14);
  });
  it("renvoie vide si aucune note", () => {
    expect(subjectAverage([n(null, 20, 1, true)])).toBeNull();
  });
});

describe("moyenne générale", () => {
  it("pondère par les coefficients et ignore les matières sans note", () => {
    const avg = generalAverage([
      { average: 15, coefficient: 4 },
      { average: 10, coefficient: 1 },
      { average: null, coefficient: 3 },
    ]);
    expect(avg).toBe(14);
  });
});

describe("rang", () => {
  it("donne le même rang aux ex aequo", () => {
    const r = ranks(new Map([["a", 12], ["b", 15.004], ["c", 15], ["d", null], ["e", 9]]));
    expect(r.get("b")).toBe(1);
    expect(r.get("c")).toBe(1);
    expect(r.get("a")).toBe(3);
    expect(r.get("e")).toBe(4);
    expect(r.get("d")).toBeNull();
  });
});

describe("statistiques", () => {
  it("calcule moyenne, max et min", () => {
    expect(stats([10, 14, null, 12])).toEqual({ mean: 12, max: 14, min: 10 });
    expect(stats([null])).toBeNull();
    expect(round2(12.3456)).toBe(12.35);
  });
});

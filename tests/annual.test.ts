import { describe, expect, it } from "vitest";
import { annualAverage, formulaText, parseWeights, proposeDecision } from "@/lib/grades/annual";

describe("moyenne annuelle", () => {
  it("formule (T1 + 2T2 + 2T3) / 5", () => {
    const r = annualAverage([10, 12, 14], [1, 2, 2]);
    expect(r.average).toBeCloseTo(12.4);
    expect(r.complete).toBe(true);
  });
  it("trimestres à poids égaux", () => {
    expect(annualAverage([9, 12, 15], [1, 1, 1]).average).toBeCloseTo(12);
  });
  it("trimestre manquant : moyenne provisoire", () => {
    const r = annualAverage([10, 12, null], [1, 2, 2]);
    expect(r.average).toBeCloseTo((10 + 24) / 3);
    expect(r.complete).toBe(false);
    expect(annualAverage([null, null, null], [1, 2, 2]).average).toBeNull();
  });
  it("décision proposée", () => {
    expect(proposeDecision(10, true, 10)).toBe("PASS");
    expect(proposeDecision(9.995, true, 10)).toBe("PASS");
    expect(proposeDecision(9.99, true, 10)).toBe("FAIL");
    expect(proposeDecision(15, false, 10)).toBe("PENDING");
  });
  it("lit les poids", () => {
    expect(parseWeights("1, 2, 2", 3)).toEqual([1, 2, 2]);
    expect(parseWeights("1 1.5 2", 3)).toEqual([1, 1.5, 2]);
    expect(parseWeights("1, 2", 3)).toBeNull();
    expect(parseWeights("0 0 0", 3)).toBeNull();
  });
});

describe("formulaText", () => {
  it("écrit la formule", () => {
    expect(formulaText([1, 2, 2])).toBe("(T1 + 2×T2 + 2×T3) / 5");
    expect(formulaText([1, 1, 1])).toBe("(T1 + T2 + T3) / 3");
  });
});

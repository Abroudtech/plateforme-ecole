import { describe, expect, it } from "vitest";
import { resolveScheme } from "@/lib/grades/scheme";

const cls = { id: "c1", gradeLevelId: "L7", trackId: null };
const row = (o: Partial<{ gradeLevelId: string; trackId: string; classGroupId: string; subjectId: string }>, w: number) => ({
  id: JSON.stringify(o),
  gradeLevelId: o.gradeLevelId ?? null,
  trackId: o.trackId ?? null,
  classGroupId: o.classGroupId ?? null,
  subjectId: o.subjectId ?? null,
  items: [{ kind: "SYNTHESIS" as const, weight: w }],
});

describe("structure d'évaluation applicable", () => {
  const rows = [
    row({}, 1),
    row({ gradeLevelId: "L7" }, 2),
    row({ gradeLevelId: "L7", subjectId: "MATH" }, 3),
    row({ classGroupId: "c1" }, 4),
    row({ classGroupId: "c1", subjectId: "AR" }, 5),
  ];
  const w = (subjectId: string, r = rows) => resolveScheme(r, cls, subjectId);

  it("prend la règle la plus précise", () => {
    expect(w("AR").source).toBe("classSubject");
    expect(w("MATH").source).toBe("class");
    expect(w("MATH", rows.slice(0, 3)).source).toBe("levelSubject");
    expect(w("FR", rows.slice(0, 3)).source).toBe("level");
    expect(w("FR", rows.slice(0, 1)).source).toBe("school");
  });

  it("revient à oral ×1, contrôle ×1, synthèse ×2 sans règle", () => {
    const r = w("FR", []);
    expect(r.source).toBe("default");
    expect(r.items.map((i) => `${i.kind}:${i.weight}`)).toEqual(["ORAL:1", "CONTROL:1", "SYNTHESIS:2"]);
  });

  it("ne prend pas la règle d'une autre filière", () => {
    const r = resolveScheme([row({ gradeLevelId: "L7", trackId: "MATH" }, 9)], cls, "FR");
    expect(r.source).toBe("default");
  });
});

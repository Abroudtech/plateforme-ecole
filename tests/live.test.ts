import { describe, expect, it } from "vitest";
import { acceptsAnswer, livePoints, liveRanking, nextPhase, remainingSeconds } from "@/lib/live";

describe("défi en direct", () => {
  it("donne plus de points aux plus rapides", () => {
    expect(livePoints(false, 100, 20)).toBe(0);
    expect(livePoints(true, 0, 20)).toBe(1000);
    expect(livePoints(true, 10_000, 20)).toBe(750);
    expect(livePoints(true, 25_000, 20)).toBe(500);
  });

  it("compte le temps restant et accepte une petite marge", () => {
    const start = new Date(1_000_000);
    expect(remainingSeconds(start, 20, 1_000_000 + 5_500)).toBe(15);
    expect(remainingSeconds(start, 20, 1_000_000 + 30_000)).toBe(0);
    expect(acceptsAnswer(start, 20, 1_000_000 + 21_000)).toBe(true);
    expect(acceptsAnswer(start, 20, 1_000_000 + 22_000)).toBe(false);
    expect(acceptsAnswer(null, 20)).toBe(false);
  });

  it("enchaîne les étapes dans l'ordre", () => {
    expect(nextPhase("LOBBY", "start", 0, 3)).toEqual({ phase: "QUESTION", current: 0 });
    expect(nextPhase("QUESTION", "reveal", 0, 3)).toEqual({ phase: "REVEAL", current: 0 });
    expect(nextPhase("REVEAL", "next", 0, 3)).toEqual({ phase: "QUESTION", current: 1 });
    expect(nextPhase("REVEAL", "next", 2, 3)).toEqual({ phase: "DONE", current: 2 });
    expect(nextPhase("QUESTION", "next", 0, 3)).toBeNull();
    expect(nextPhase("LOBBY", "end", 0, 3)).toEqual({ phase: "DONE", current: 0 });
  });

  it("classe les joueurs, ex aequo compris", () => {
    const r = liveRanking(
      [{ studentId: "a" }, { studentId: "b" }, { studentId: "c" }],
      [
        { studentId: "a", points: 900 },
        { studentId: "b", points: 900 },
        { studentId: "c", points: 0 },
      ],
    );
    expect(r.map((x) => [x.studentId, x.rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
    expect(r[0].correct).toBe(1);
  });
});

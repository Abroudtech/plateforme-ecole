import { describe, expect, it } from "vitest";
import { findConflicts, formatDuration, formatTime, overlaps, parseTime } from "@/lib/timetable";

describe("heures", () => {
  it("lit les formats courants", () => {
    expect(parseTime("08:30")).toBe(510);
    expect(parseTime("8h30")).toBe(510);
    expect(parseTime("14h")).toBe(840);
    expect(parseTime("25:00")).toBeNull();
    expect(formatTime(510)).toBe("08:30");
  });
});

describe("conflits", () => {
  const base = { dayOfWeek: 1, startMinute: 480, endMinute: 540 };
  it("deux cours qui se suivent ne se chevauchent pas", () => {
    expect(overlaps(base, { ...base, startMinute: 540, endMinute: 600 })).toBe(false);
    expect(overlaps(base, { ...base, startMinute: 510, endMinute: 600 })).toBe(true);
    expect(overlaps(base, { ...base, dayOfWeek: 2 })).toBe(false);
  });
  it("détecte classe, enseignant et salle déjà occupés", () => {
    const existing = [
      { id: "1", ...base, classGroupId: "A", teacherId: "T1", roomId: "R1" },
      { id: "2", ...base, classGroupId: "B", teacherId: "T2", roomId: "R2" },
      { id: "3", ...base, classGroupId: "C", teacherId: "T3", roomId: "R3" },
    ];
    const kinds = (e: { classGroupId: string; teacherId: string | null; roomId: string | null }) =>
      findConflicts({ ...base, ...e }, existing).map((c) => c.kind);
    expect(kinds({ classGroupId: "A", teacherId: null, roomId: null })).toEqual(["class"]);
    expect(kinds({ classGroupId: "Z", teacherId: "T2", roomId: null })).toEqual(["teacher"]);
    expect(kinds({ classGroupId: "Z", teacherId: null, roomId: "R3" })).toEqual(["room"]);
    expect(kinds({ classGroupId: "Z", teacherId: "T9", roomId: "R9" })).toEqual([]);
  });
});

describe("formatDuration", () => {
  const tpl = { duration: "{h} h {m}", durationHours: "{h} h" };
  it("affiche heures et minutes", () => {
    expect(formatDuration(3.75, tpl)).toBe("3 h 45");
    expect(formatDuration(4, tpl)).toBe("4 h");
    expect(formatDuration(0, tpl)).toBe("0 h");
    expect(formatDuration(1 + 5 / 60, tpl)).toBe("1 h 05");
  });
});

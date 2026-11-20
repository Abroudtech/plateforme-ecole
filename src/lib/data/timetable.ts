import "server-only";
import { db } from "@/lib/db";

const include = { subject: true, teacher: true, room: true, classGroup: true } as const;
const orderBy = [{ dayOfWeek: "asc" as const }, { startMinute: "asc" as const }];

export function getClassTimetable(schoolId: string, classGroupId: string) {
  return db.timetableEntry.findMany({ where: { schoolId, classGroupId }, include, orderBy });
}

export function getTeacherTimetable(schoolId: string, teacherId: string, academicYearId: string | null) {
  return db.timetableEntry.findMany({
    where: { schoolId, teacherId, ...(academicYearId ? { classGroup: { academicYearId } } : {}) },
    include,
    orderBy,
  });
}

export function listTeachers(schoolId: string) {
  return db.teacher.findMany({ where: { schoolId }, orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }] });
}

export function listRooms(schoolId: string) {
  return db.room.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export type TimetableRow = Awaited<ReturnType<typeof getClassTimetable>>[number];

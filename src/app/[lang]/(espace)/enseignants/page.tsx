import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import { listTeachers } from "@/lib/data/timetable";
import { formatDuration } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { saveTeacher } from "../emplois-du-temps/actions";
import { TeacherFields } from "./teacher-fields";

export default async function TeachersPage({ params }: PageProps<"/[lang]/enseignants">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const year = await getCurrentYear(ctx.school.id);
  const [teachers, entries] = await Promise.all([
    listTeachers(ctx.school.id),
    db.timetableEntry.findMany({
      where: { schoolId: ctx.school.id, teacherId: { not: null }, ...(year ? { classGroup: { academicYearId: year.id } } : {}) },
      select: { teacherId: true, startMinute: true, endMinute: true },
    }),
  ]);
  const hours = new Map<string, number>();
  for (const e of entries) hours.set(e.teacherId!, (hours.get(e.teacherId!) ?? 0) + (e.endMinute - e.startMinute) / 60);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={dict.teachers.title} back={{ href: `/${lang}/emplois-du-temps`, label: dict.timetable.title }} />
      <Card>
        {teachers.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.teachers.none}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {teachers.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/${lang}/enseignants/${x.id}`}
                  className={`flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3 hover:bg-blue-50 ${x.isActive ? "" : "opacity-60"}`}
                >
                  <span className="font-semibold">{personName(x, lang)}</span>
                  <span className="shrink-0 text-sm text-slate-600">
                    {x.isActive ? t(dict.teachers.hoursWeek, { hours: formatDuration(hours.get(x.id) ?? 0, dict.timetable) }) : dict.teachers.inactive}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {can(ctx.roles, "staff.write") && (
        <Card title={dict.teachers.add}>
          <ActionForm action={saveTeacher.bind(null, lang, null)} labels={formLabels(dict, dict.common.add)} resetOnSuccess>
            <TeacherFields dict={dict} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

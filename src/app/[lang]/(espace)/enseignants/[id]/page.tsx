import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import { getTeacherTimetable } from "@/lib/data/timetable";
import { formatDuration } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader } from "@/components/ui";
import { WeekTimetable } from "@/components/week-timetable";
import { saveTeacher, setTeacherActive } from "../../emplois-du-temps/actions";
import { TeacherFields } from "../teacher-fields";

export default async function TeacherPage({ params }: PageProps<"/[lang]/enseignants/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const teacher = await db.teacher.findFirst({ where: { id, schoolId: ctx.school.id } });
  if (!teacher) notFound();
  const year = await getCurrentYear(ctx.school.id);
  const entries = await getTeacherTimetable(ctx.school.id, teacher.id, year?.id ?? null);
  const total = entries.reduce((sum, e) => sum + (e.endMinute - e.startMinute) / 60, 0);
  const canWrite = can(ctx.roles, "staff.write");

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={personName(teacher, lang)}
          subtitle={`${dict.teachers.timetable} · ${t(dict.teachers.hoursWeek, { hours: formatDuration(total, dict.timetable) })}${teacher.isActive ? "" : ` · ${dict.teachers.inactive}`}`}
          back={{ href: `/${lang}/enseignants`, label: dict.teachers.title }}
          action={<PrintButton label={dict.reportCards.print} />}
        />
      </div>
      <h1 className="hidden text-xl font-bold print:block">{dict.teachers.timetable} · {personName(teacher, lang)}</h1>
      <WeekTimetable entries={entries} dict={dict} lang={lang} show="class" />
      {canWrite && (
        <>
          <Card title={dict.common.edit} className="print:hidden">
            <ActionForm action={saveTeacher.bind(null, lang, teacher.id)} labels={formLabels(dict, dict.common.save)}>
              <TeacherFields dict={dict} value={teacher} />
            </ActionForm>
          </Card>
          <div className="print:hidden">
            <ActionForm
              action={setTeacherActive.bind(null, lang, teacher.id, !teacher.isActive)}
              labels={formLabels(dict, teacher.isActive ? dict.teachers.deactivate : dict.teachers.reactivate)}
              variant={teacher.isActive ? "danger" : "secondary"}
            />
          </div>
        </>
      )}
    </div>
  );
}

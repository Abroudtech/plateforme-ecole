import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import { getTeacherTimetable } from "@/lib/data/timetable";
import { formatDuration } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { WeekTimetable } from "@/components/week-timetable";
import { createTeacherAccess, saveTeacher, saveTeacherClasses, setTeacherActive } from "../../emplois-du-temps/actions";
import { TeacherFields } from "../teacher-fields";

export default async function TeacherPage({ params }: PageProps<"/[lang]/enseignants/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const teacher = await db.teacher.findFirst({ where: { id, schoolId: ctx.school.id } });
  if (!teacher) notFound();
  // Un enseignant ne voit que sa propre fiche.
  if (!can(ctx.roles, "staff.write") && teacher.userId !== ctx.user.id) notFound();
  const year = await getCurrentYear(ctx.school.id);
  const entries = await getTeacherTimetable(ctx.school.id, teacher.id, year?.id ?? null);
  const total = entries.reduce((sum, e) => sum + (e.endMinute - e.startMinute) / 60, 0);
  const canWrite = can(ctx.roles, "staff.write");
  const [classes, assignments] = canWrite
    ? await Promise.all([
        db.classGroup.findMany({
          where: { schoolId: ctx.school.id, academicYearId: year?.id ?? "__aucune__" },
          include: { gradeLevel: true },
          orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
        }),
        db.teacherAssignment.findMany({ where: { schoolId: ctx.school.id, teacherId: teacher.id } }),
      ])
    : [[], []];
  const assigned = new Set(assignments.map((a) => a.classGroupId));
  const timetableClasses = new Set(entries.map((e) => e.classGroupId));
  const tt = dict.teachers;

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={personName(teacher, lang)}
          subtitle={`${dict.teachers.timetable} · ${t(dict.teachers.hoursWeek, { hours: formatDuration(total, dict.timetable) })}${teacher.isActive ? "" : ` · ${dict.teachers.inactive}`}`}
          back={
            can(ctx.roles, "staff.write")
              ? { href: `/${lang}/enseignants`, label: dict.teachers.title }
              : { href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }
          }
          action={
            <div className="flex flex-wrap gap-2">
              <PrintButton label={dict.reportCards.print} />
              {can(ctx.roles, "attestations.write") && <ButtonLink href={`/${lang}/enseignants/${teacher.id}/attestation`}>{tt.attestation}</ButtonLink>}
            </div>
          }
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
          <Card title={tt.access} className="print:hidden">
            <p className="mb-3 text-sm text-slate-600">{teacher.userId ? tt.hasAccount : tt.noAccount}</p>
            <ActionForm
              action={createTeacherAccess.bind(null, lang, teacher.id)}
              labels={{
                ...formLabels(dict, teacher.userId ? tt.resetPassword : tt.createAccount),
                credentials: { intro: tt.accountCreated, login: dict.guardians.login, password: dict.guardians.tempPassword },
              }}
              variant="secondary"
              confirm={teacher.userId ? `${tt.resetPassword} ?` : undefined}
            />
          </Card>
          <Card title={tt.classes} className="print:hidden">
            <p className="mb-3 text-sm text-slate-600">{tt.classesHelp}</p>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-500">{tt.noClasses}</p>
            ) : (
              <ActionForm action={saveTeacherClasses.bind(null, lang, teacher.id)} labels={formLabels(dict, dict.common.save)}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {classes.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                      <input
                        type="checkbox"
                        name="classIds"
                        value={c.id}
                        defaultChecked={assigned.has(c.id) || timetableClasses.has(c.id)}
                        className="size-4 accent-blue-900"
                      />
                      <span className="font-medium">{className(c, lang)}</span>
                      {timetableClasses.has(c.id) && <span className="text-xs text-slate-500">· {tt.fromTimetable}</span>}
                    </label>
                  ))}
                </div>
              </ActionForm>
            )}
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

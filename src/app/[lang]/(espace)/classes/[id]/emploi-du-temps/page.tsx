import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClass } from "@/lib/data/classes";
import { getClassCurriculum } from "@/lib/data/grades";
import { getClassTimetable, listRooms, listTeachers } from "@/lib/data/timetable";
import { DAYS, formatDuration } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { WeekTimetable } from "@/components/week-timetable";
import { ClassTabs } from "../../class-tabs";
import { addTimetableEntry } from "../../../emplois-du-temps/actions";

export default async function ClassTimetablePage({ params }: PageProps<"/[lang]/classes/[id]/emploi-du-temps">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();
  const canWrite = can(ctx.roles, "timetable.write");
  const [entries, curriculum, teachers, rooms] = await Promise.all([
    getClassTimetable(ctx.school.id, cls.id),
    getClassCurriculum(ctx.school.id, cls),
    canWrite ? listTeachers(ctx.school.id) : Promise.resolve([]),
    canWrite ? listRooms(ctx.school.id) : Promise.resolve([]),
  ]);
  const tt = dict.timetable;

  // Heures programmées par matière (et heures prévues au programme si renseignées).
  const hours = curriculum.map((c) => ({
    subject: c.subject,
    planned: c.hoursPerWeek != null ? Number(c.hoursPerWeek) : null,
    done: entries.filter((e) => e.subjectId === c.subjectId).reduce((sum, e) => sum + (e.endMinute - e.startMinute) / 60, 0),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name}
          subtitle={tt.title}
          back={{ href: `/${lang}/classes`, label: dict.classes.title }}
          action={<PrintButton label={dict.reportCards.print} />}
        />
        <ClassTabs lang={lang} classId={cls.id} dict={dict} active="timetable" />
      </div>
      <h1 className="hidden text-xl font-bold print:block">{tt.title} · {cls.name}</h1>

      <WeekTimetable entries={entries} dict={dict} lang={lang} show="teacher" canDelete={canWrite} />

      <Card title={tt.hours} className="print:hidden">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {hours.map((h) => (
            <li key={h.subject.id} className="flex justify-between">
              <span>{pickName(h.subject, lang)}</span>
              <span className={h.planned != null && h.done < h.planned ? "text-amber-700" : "text-slate-600"}>
                {h.planned != null
                  ? t(tt.hoursOf, { done: formatDuration(h.done, tt), planned: formatDuration(h.planned, tt) })
                  : formatDuration(h.done, tt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {canWrite && (
        <Card title={tt.addEntry} className="print:hidden">
          <ActionForm action={addTimetableEntry.bind(null, lang, cls.id)} labels={formLabels(dict, dict.common.add)} resetOnSuccess>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={tt.day}>
                <Select name="dayOfWeek" defaultValue="1">
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{tt.days[String(d) as keyof typeof tt.days]}</option>
                  ))}
                </Select>
              </Field>
              <Field label={tt.start}>
                <Input name="start" type="time" required defaultValue="08:00" step={300} />
              </Field>
              <Field label={tt.end}>
                <Input name="end" type="time" required defaultValue="09:00" step={300} />
              </Field>
              <Field label={tt.subject}>
                <Select name="subjectId" required defaultValue="">
                  <option value="" disabled>—</option>
                  {curriculum.map((c) => (
                    <option key={c.subjectId} value={c.subjectId}>{pickName(c.subject, lang)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={tt.teacher}>
                <Select name="teacherId" defaultValue="">
                  <option value="">{tt.none}</option>
                  {teachers.filter((x) => x.isActive).map((x) => (
                    <option key={x.id} value={x.id}>{personName(x, lang)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={tt.room}>
                <Select name="roomId" defaultValue="">
                  <option value="">{tt.none}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

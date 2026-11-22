import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { formLabels } from "@/i18n/form-labels";
import { reviewAbsenceNote } from "./notes-actions";
import Link from "next/link";
import { scopeOf } from "@/lib/auth/scope";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDayOverview } from "@/lib/data/attendance";
import { getCurrentYear } from "@/lib/data/school";
import { parseISODate, todayISO, toISODate } from "@/lib/dates";
import { AttendanceList } from "@/components/attendance-list";
import { Button, Card, Input, PageHeader } from "@/components/ui";

export default async function AbsencesPage({ params, searchParams }: PageProps<"/[lang]/absences">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "attendance.read");
  const date = parseISODate(typeof sp.date === "string" ? sp.date : null) ?? parseISODate(todayISO())!;
  const dateISO = toISODate(date);
  const year = await getCurrentYear(ctx.school.id);
  const scope = await scopeOf(ctx);
  const overview = await getDayOverview(ctx.school.id, year?.id ?? null, date);
  const { done } = overview;
  const records = overview.records.filter((r) => !scope || scope.includes(r.classGroupId));
  const classes = overview.classes.filter((c) => !scope || scope.includes(c.id));
  const a = dict.attendance;
  const dateLabel = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { dateStyle: "full", timeZone: "UTC" }).format(date);
  // Justificatifs envoyés par les parents, à valider par la direction.
  const notes = can(ctx.roles, "attendance.justify")
    ? (
        await db.absenceNote.findMany({
          where: { schoolId: ctx.school.id, status: "PENDING" },
          select: { id: true, studentId: true, reason: true, recordIds: true, fileType: true, student: true },
          orderBy: { createdAt: "asc" },
        })
      ).map((x) => ({ ...x, hasFile: !!x.fileType }))
    : [];
  const todo = (["MORNING", "AFTERNOON"] as const).map((p) => ({ period: p, classes: classes.filter((c) => !done.has(`${c.id}:${p}`)) }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={a.title} subtitle={dateLabel} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />

      <form className="flex items-end gap-2">
        <div className="w-44">
          <Input name="date" type="date" defaultValue={dateISO} aria-label={a.date} />
        </div>
        <Button type="submit" variant="secondary">{a.show}</Button>
      </form>

      {notes.length > 0 && (
        <Card title={t(dict.absenceNotes.toReview, { count: notes.length })}>
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p>
                  <Link href={`/${lang}/eleves/${note.studentId}`} className="font-semibold hover:text-blue-700">{personName(note.student, lang)}</Link>
                  <span className="text-slate-500"> · {t(dict.absenceNotes.halfDays, { count: note.recordIds.length })}</span>
                </p>
                <p className="mt-1" dir="auto">« {note.reason} »</p>
                {note.hasFile && (
                  <a href={`/${lang}/justificatifs/${note.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium text-blue-800 underline">
                    {dict.absenceNotes.viewFile}
                  </a>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm action={reviewAbsenceNote.bind(null, lang, note.id, true)} labels={formLabels(dict, dict.absenceNotes.accept)} />
                  <ActionForm action={reviewAbsenceNote.bind(null, lang, note.id, false)} labels={formLabels(dict, dict.absenceNotes.reject)} variant="secondary" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t(a.dayList, { date: dateLabel })}>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">{a.noneToday}</p>
        ) : (
          <AttendanceList
            records={records}
            dict={dict}
            lang={lang}
            canWrite={can(ctx.roles, "attendance.justify")}
            renderLabel={(r) => {
              const rec = records.find((x) => x.id === r.id)!;
              return (
                <Link href={`/${lang}/eleves/${rec.studentId}`} className="hover:text-blue-700">
                  {personName(rec.student, lang)} <span className="text-sm font-normal text-slate-500">· {rec.classGroup.name}</span>
                </Link>
              );
            }}
          />
        )}
      </Card>

      <Card title={a.classesTodo}>
        {todo.map(({ period, classes: list }) => (
          <div key={period} className="mb-3 last:mb-0">
            <p className="mb-1 text-sm font-medium text-slate-600">{a.periods[period]}</p>
            {list.length === 0 ? (
              <p className="text-sm text-green-700">✓</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/${lang}/classes/${c.id}/absences?date=${dateISO}&periode=${period}`}
                    className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                  >
                    {lang === "ar" && c.nameAr ? c.nameAr : c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

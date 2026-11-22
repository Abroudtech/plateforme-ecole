import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { getStudentAttendance } from "@/lib/data/attendance";
import { isGuardianOf } from "@/lib/data/grades";
import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { submitAbsenceNote } from "../../../absences/notes-actions";

/** Espace parent : absences d'un enfant et envoi d'un justificatif. */
export default async function ChildAbsencesPage({ params }: PageProps<"/[lang]/eleves/[id]/absences">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "children.read");
  if (!(await isGuardianOf(ctx.school.id, ctx.user.id, id))) redirect(`/${lang}/acces-refuse`);
  const student = await db.student.findFirst({ where: { id, schoolId: ctx.school.id } });
  if (!student) notFound();
  const [{ records, summary }, notes] = await Promise.all([
    getStudentAttendance(ctx.school.id, id),
    db.absenceNote.findMany({ where: { schoolId: ctx.school.id, studentId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, reason: true, status: true, createdAt: true, recordIds: true } }),
  ]);
  const a = dict.attendance;
  const n = dict.absenceNotes;
  const pendingIds = new Set(notes.filter((x) => x.status === "PENDING").flatMap((x) => x.recordIds));
  const fmt = (d: Date) => new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
  const open = records.filter((r) => !r.justified && !pendingIds.has(r.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={a.title} subtitle={personName(student, lang)} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <p className="text-sm text-slate-600">{t(a.summary, summary)}</p>

      {open.length > 0 && (
        <Card title={n.send}>
          <ActionForm action={submitAbsenceNote.bind(null, lang, id)} labels={{ ...formLabels(dict, n.send), saved: n.sent }} resetOnSuccess>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium">{n.which}</legend>
              {open.map((r) => (
                <label key={r.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <input type="checkbox" name="recordId" value={r.id} defaultChecked={open.length === 1} className="size-5" />
                  {fmt(r.date)} · {a.periods[r.period]} · {a.statuses[r.status]}
                </label>
              ))}
            </fieldset>
            <Field label={n.reason}>
              <textarea name="reason" required rows={3} maxLength={500} dir="auto" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base" />
            </Field>
            <Field label={n.file} hint={n.fileHint}>
              <input type="file" name="file" accept="image/*,application/pdf" capture="environment" className="text-sm" />
            </Field>
          </ActionForm>
        </Card>
      )}

      <Card title={a.history}>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">{n.noAbsence}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{fmt(r.date)} · {a.periods[r.period]} · {a.statuses[r.status]}</span>
                <span className={r.justified ? "text-emerald-700" : pendingIds.has(r.id) ? "text-amber-700" : "text-red-700"}>
                  {r.justified ? a.justified : pendingIds.has(r.id) ? n.pending : n.notJustified}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

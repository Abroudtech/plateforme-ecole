import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, DoorOpen, FileText, Pencil, Printer, Sparkles, TriangleAlert } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { requireClassAccess } from "@/lib/auth/scope";
import { examStats } from "@/lib/calendar";
import { managedClasses } from "@/lib/data/class-space";
import { todayISO, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { formatDay } from "@/components/homework-entry";
import { Card, PageHeader } from "@/components/ui";
import { deleteExam, gradeExam, saveExam } from "../actions";
import { ExamForm } from "../exam-form";
import { DateBadge, examFormProps, whenLabel } from "../exam-ui";

/** Un examen : ce qui a été annoncé, le sujet, la saisie des notes et les résultats. */
export default async function ExamPage({ params, searchParams }: PageProps<"/[lang]/examens/[id]">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "exams.write");
  const e = dict.exams;
  const exam = await db.exam.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: {
      classGroup: { include: { gradeLevel: true } },
      subject: true,
      author: true,
      resource: { select: { id: true, title: true } },
      assessment: { include: { grades: true } },
    },
  });
  if (!exam) notFound();
  await requireClassAccess(lang, ctx, exam.classGroupId);
  const isAdmin = ctx.roles.includes("ADMIN");
  const mine = isAdmin || exam.authorId === ctx.user.id;
  const editing = mine && sp.modifier === "1";
  const today = todayISO();
  const iso = toISODate(exam.date);

  const [sameDay, enrolled] = await Promise.all([
    db.exam.count({ where: { schoolId: ctx.school.id, classGroupId: exam.classGroupId, date: exam.date } }),
    db.enrollment.count({ where: { classGroupId: exam.classGroupId, status: "ACTIVE" } }),
  ]);
  const grades = exam.assessment?.grades ?? [];
  const stats = exam.assessment ? examStats(grades.map((g) => (g.absent || g.score == null ? null : Number(g.score))), Number(exam.assessment.maxScore)) : null;
  const when = whenLabel(exam.date, today, dict);
  const fmt = (n: number) => n.toFixed(2).replace(/\.?0+$/, "").replace(".", lang === "fr" ? "," : ".");

  if (editing) {
    const form = await examFormProps(ctx, await managedClasses(ctx), lang, dict);
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={e.edit} back={{ href: `/${lang}/examens/${exam.id}`, label: e.title }} />
        <Card>
          <ExamForm
            action={saveExam.bind(null, lang, exam.id)}
            {...form}
            editing
            today={today}
            lang={lang}
            defaults={{
              classGroupId: exam.classGroupId,
              subjectId: exam.subjectId,
              kind: exam.kind,
              date: iso,
              time: exam.startMinute != null ? formatTime(exam.startMinute) : "",
              duration: exam.durationMinutes,
              room: exam.room,
              title: exam.title,
              revision: exam.revision,
              resourceId: exam.resourceId,
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${pickName(exam.subject, lang)} · ${className(exam.classGroup, lang)}`}
        subtitle={`${dict.grades.kinds[exam.kind]}${exam.title ? ` · ${exam.title}` : ""}${exam.author ? ` · ${t(e.by, { name: personName(exam.author, lang) })}` : ""}`}
        back={{ href: `/${lang}/examens`, label: e.title }}
        action={
          mine ? (
            <Link href={`/${lang}/examens/${exam.id}?modifier=1`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-900 ring-1 ring-slate-200 hover:ring-gold-400">
              <Pencil size={15} aria-hidden /> {dict.common.edit}
            </Link>
          ) : undefined
        }
      />

      <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
        <DateBadge date={exam.date} lang={lang} tone={iso < today ? "green" : "gold"} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold capitalize leading-tight">{formatDay(exam.date, lang)}</p>
          {when && <p className="text-sm font-semibold text-gold-700">{when}</p>}
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {exam.startMinute != null && (
              <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> <bdi dir="ltr">{formatTime(exam.startMinute)}</bdi></span>
            )}
            {exam.durationMinutes && <span>{t(e.minutes, { count: exam.durationMinutes })}</span>}
            {exam.room && <span className="inline-flex items-center gap-1"><DoorOpen size={14} aria-hidden /> {exam.room}</span>}
          </p>
        </div>
      </section>

      {sameDay > 1 && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert size={16} aria-hidden /> {t(e.busy, { count: sameDay })}
        </p>
      )}

      <Card title={e.revision}>
        {exam.revision ? <p className="whitespace-pre-wrap" dir="auto">{exam.revision}</p> : <p className="text-sm text-slate-500">—</p>}
        <p className="mt-2 text-xs text-slate-500">{e.revisionHint}</p>
      </Card>

      <Card title={e.paper}>
        {exam.resource ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex min-w-0 items-center gap-2 font-semibold" dir="auto"><FileText size={18} className="shrink-0 text-blue-800" aria-hidden /> {exam.resource.title}</span>
            <Link href={`/${lang}/atelier/${exam.resource.id}`} className="ms-auto inline-flex items-center gap-2 rounded-xl bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              <Printer size={15} aria-hidden /> {e.printPaper}
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500">{e.noPaper}</p>
            {mine && can(ctx.roles, "ai.use") && exam.classGroup.gradeLevel.cycle === "PRIMARY" && (
              <Link
                href={`/${lang}/atelier?type=EXAM&niveau=${exam.classGroup.gradeLevelId}&matiere=${exam.subjectId}${exam.title ? `&theme=${encodeURIComponent(exam.title)}` : ""}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-50 px-3 py-2 text-sm font-semibold text-gold-900 ring-1 ring-gold-200 hover:bg-gold-100"
              >
                <Sparkles size={15} aria-hidden /> {e.makePaper}
              </Link>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">{e.paperHint}</p>
      </Card>

      <Card title={e.results}>
        <div className="flex flex-wrap items-center gap-3">
          <ActionForm action={gradeExam.bind(null, lang, exam.id)} labels={formLabels(dict, e.grade)} className="contents" />
          {exam.assessment && <p className="text-sm text-slate-600">{t(e.gradesEntered, { count: grades.filter((g) => g.score != null || g.absent).length })} / {enrolled}</p>}
        </div>
        {stats && (
          <div className="mt-4 flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: e.mean, value: fmt(stats.mean), strong: true },
                { label: e.max, value: fmt(stats.max) },
                { label: e.min, value: fmt(stats.min) },
                { label: e.below, value: `${stats.below} / ${stats.count}` },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 ${s.strong ? "bg-blue-900 text-white" : "bg-slate-50"}`}>
                  <dt className={`text-xs ${s.strong ? "text-white/70" : "text-slate-500"}`}>{s.label}</dt>
                  <dd className="text-2xl font-bold tabular-nums"><bdi dir="ltr">{s.value}</bdi></dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">{e.distribution}</p>
              <div className="flex h-28 items-end gap-3" dir="ltr">
                {stats.buckets.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-bold tabular-nums">{n}</span>
                    <span
                      className={`w-full rounded-t-lg ${i < 2 ? "bg-gold-500" : i === 2 ? "bg-blue-500" : "bg-blue-900"}`}
                      style={{ height: `${Math.max(4, (n / Math.max(1, ...stats.buckets)) * 100)}%` }}
                    />
                    <span className="text-[11px] text-slate-500">{["0–5", "5–10", "10–15", "15–20"][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {mine && (
        <ActionForm action={deleteExam.bind(null, lang, exam.id)} labels={formLabels(dict, e.delete)} variant="danger" confirm={e.confirmDelete} />
      )}
    </div>
  );
}

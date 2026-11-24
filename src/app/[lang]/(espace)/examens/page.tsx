import Link from "next/link";
import { CalendarRange, ChevronRight, ClipboardCheck, FileText, Plus, TriangleAlert } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { busyDays } from "@/lib/calendar";
import { listExams, listPastExams, type ExamRow } from "@/lib/data/calendar";
import { managedClasses } from "@/lib/data/class-space";
import { parseISODate, todayISO, toISODate } from "@/lib/dates";
import { formatTime } from "@/lib/timetable";
import { Card, PageHeader } from "@/components/ui";
import { saveExam } from "./actions";
import { ExamForm } from "./exam-form";
import { DateBadge, examFormProps, whenLabel } from "./exam-ui";

/** « Préparer un examen » : l'enseignant annonce ses examens ; la direction voit ceux de l'école. */
export default async function ExamsPage({ params, searchParams }: PageProps<"/[lang]/examens">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "exams.write");
  const e = dict.exams;
  const schoolId = ctx.school.id;
  const today = todayISO();
  const todayDate = parseISODate(today)!;

  const scope = await scopeOf(ctx);
  const classes = await managedClasses(ctx);
  const [upcoming, past] = await Promise.all([listExams(schoolId, scope, todayDate), listPastExams(schoolId, scope, todayDate)]);
  const busy = busyDays(upcoming.map((x) => ({ classGroupId: x.classGroupId, date: toISODate(x.date) })));
  const form = await examFormProps(ctx, classes, lang, dict);
  const preselect = typeof sp.classe === "string" ? sp.classe : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={e.title}
        subtitle={e.subtitle}
        action={
          <Link href={`/${lang}/calendrier`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-900 ring-1 ring-slate-200 hover:ring-gold-400">
            <CalendarRange size={16} aria-hidden /> {dict.nav.calendar}
          </Link>
        }
      />

      {classes.length === 0 ? (
        <p className="rounded-2xl bg-gold-50 p-4 text-gold-900 ring-1 ring-gold-200">{e.noClasses}</p>
      ) : (
        <details open={upcoming.length === 0 || !!preselect} className="group rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500 text-blue-950">
              <Plus size={20} className="transition group-open:rotate-45" aria-hidden />
            </span>
            <span className="text-lg font-bold text-blue-900">{e.prepare}</span>
          </summary>
          <div className="px-4 pb-5 sm:px-5">
            <ExamForm action={saveExam.bind(null, lang, null)} {...form} defaults={{ classGroupId: preselect }} today={today} lang={lang} />
            <p className="mt-3 text-xs text-slate-500">{e.tip}</p>
          </div>
        </details>
      )}

      <Card title={`${e.upcoming} (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">{e.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((x) => (
              <ExamLine key={x.id} exam={x} lang={lang} dict={dict} today={today} busy={busy.get(`${x.classGroupId}|${toISODate(x.date)}`)} />
            ))}
          </ul>
        )}
      </Card>

      <Card title={e.past}>
        {past.length === 0 ? (
          <p className="text-sm text-slate-500">{e.nonePast}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {past.map((x) => (
              <ExamLine key={x.id} exam={x} lang={lang} dict={dict} today={today} graded={x.assessment?._count.grades} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ExamLine({ exam: x, lang, dict, today, busy, graded }: { exam: ExamRow; lang: Locale; dict: Dictionary; today: string; busy?: number; graded?: number }) {
  const e = dict.exams;
  const when = whenLabel(x.date, today, dict);
  return (
    <li>
      <Link href={`/${lang}/examens/${x.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-gold-50">
        <DateBadge date={x.date} lang={lang} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {pickName(x.subject, lang)} · {className(x.classGroup, lang)}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {dict.grades.kinds[x.kind]}
            {x.title ? ` · ${x.title}` : ""}
            {x.startMinute != null && <> · <bdi dir="ltr">{formatTime(x.startMinute)}</bdi></>}
            {when ? ` · ${when}` : ""}
          </span>
          {busy && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
              <TriangleAlert size={12} aria-hidden /> {t(e.busyShort, { count: busy })}
            </span>
          )}
        </span>
        {x.resourceId && <FileText size={16} className="shrink-0 text-blue-800" aria-label={e.paper} />}
        {graded != null && graded > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            <ClipboardCheck size={12} aria-hidden /> {graded}
          </span>
        )}
        <ChevronRight size={16} className="shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}


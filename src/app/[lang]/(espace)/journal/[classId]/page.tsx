import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { requireClassAccess, teacherOf } from "@/lib/auth/scope";
import { parseISODate, todayISO } from "@/lib/dates";
import { getClass } from "@/lib/data/classes";
import { journalDraft, journalOptions, listJournals } from "@/lib/data/journal";
import { addDays, LIFE_SKILLS, mondayOf } from "@/lib/journal";
import { formatTime } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { ClassTabs } from "../../classes/class-tabs";
import { deleteJournal, saveJournal } from "../actions";
import { JournalEditor } from "../journal-editor";
import { JournalSheet } from "../journal-sheet";

/** Journal d'une classe pour un jour : saisie par l'enseignant, lecture par la direction. */
export default async function JournalDayPage({ params, searchParams }: PageProps<"/[lang]/journal/[classId]">) {
  const { lang: rawLang, classId } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const L = dict.journal;
  const ctx = await requirePermission(lang, "journal.read");
  await requireClassAccess(lang, ctx, classId);
  const schoolId = ctx.school.id;
  const cls = await getClass(schoolId, classId);
  if (!cls) notFound();

  const date = typeof sp.date === "string" && parseISODate(sp.date) ? sp.date : todayISO();
  const day = parseISODate(date)!;
  const isAdmin = ctx.roles.includes("ADMIN");
  const teacher = can(ctx.roles, "journal.write") ? await teacherOf(schoolId, ctx.user.id) : null;
  const canWrite = !!teacher;

  const journals = await listJournals(schoolId, classId, day, day, isAdmin ? null : ctx.user.id, lang);
  const mine = journals.find((j) => j.authorId === ctx.user.id);
  const others = journals.filter((j) => j.authorId !== ctx.user.id);

  let editor = null;
  if (canWrite) {
    const opts = await journalOptions(schoolId, cls, lang);
    const draft = mine ? null : await journalDraft(schoolId, classId, date, teacher.id, ctx.user.id, lang, opts.programme);
    const start = mine ? mine.startMinute : draft!.startMinute;
    const end = mine ? mine.endMinute : draft!.endMinute;
    editor = (
      <Card>
        {!mine && draft!.rows.length > 0 && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{L.fromTimetable}</p>}
        <JournalEditor
          key={date}
          action={saveJournal.bind(null, lang, classId, date)}
          labels={formLabels(dict)}
          L={L}
          initial={{
            start: start !== null ? formatTime(start) : "",
            end: end !== null ? formatTime(end) : "",
            week: (mine ? mine.week : draft!.week) ?? "",
            unit: (mine ? mine.unit : draft!.unit) ?? "",
            unitDay: mine?.unitDay ?? "",
            lifeSkills: mine?.lifeSkills ?? [],
            rows: mine ? mine.rows : draft!.rows,
          }}
          subjects={opts.subjects}
          lessons={opts.lessons}
          skills={LIFE_SKILLS.map((s) => ({ key: s.key, label: lang === "ar" ? s.ar : s.fr }))}
        />
      </Card>
    );
  }

  const long = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const base = `/${lang}/journal/${classId}`;
  const monday = mondayOf(date);
  const printHref = (from: string, to: string) => `${base}/imprimer?du=${from}&au=${to}`;
  const sheetData = (j: (typeof journals)[number]) => ({ ...j, className: className(cls, lang) });
  const schoolName = pickName(ctx.school, lang);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={className(cls, lang)}
        subtitle={`${L.title} · ${pickName(cls.gradeLevel, lang)}`}
        back={{ href: `/${lang}/journal?semaine=${monday}`, label: L.title }}
      />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="journal" />

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
        <Link href={`${base}?date=${addDays(date, -1)}`} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-50" aria-label={L.prevDay} title={L.prevDay}>
          <ChevronLeft size={20} className="rtl:rotate-180" aria-hidden />
        </Link>
        <div className="text-center">
          <p className="font-bold capitalize text-blue-900">{long.format(day)}</p>
          {date !== todayISO() && (
            <Link href={base} className="text-xs font-semibold text-blue-800 hover:underline">{L.today}</Link>
          )}
        </div>
        <Link href={`${base}?date=${addDays(date, 1)}`} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-50" aria-label={L.nextDay} title={L.nextDay}>
          <ChevronRight size={20} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {journals.length > 0 && (
          <Link href={printHref(date, date)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-900 ring-1 ring-slate-200 hover:ring-gold-400">
            <Printer size={15} aria-hidden /> {L.print}
          </Link>
        )}
        <Link href={printHref(monday, addDays(monday, 5))} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-900 ring-1 ring-slate-200 hover:ring-gold-400">
          <Printer size={15} aria-hidden /> {L.printWeek}
        </Link>
      </div>

      {editor}

      {canWrite && mine && (
        <ActionForm action={deleteJournal.bind(null, lang, classId, date)} labels={formLabels(dict, L.delete)} variant="danger" confirm={L.confirmDelete} />
      )}

      {!canWrite && others.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">{L.none}</p>}
      {others.length > 0 && (
        <>
          {!canWrite && <p className="text-sm text-slate-500">{L.readOnly}</p>}
          {others.map((j) => (
            <section key={j.id} className="flex flex-col gap-2">
              {canWrite && <h2 className="font-bold text-blue-900">{t(L.byTeacher, { name: j.teacherName })}</h2>}
              <JournalSheet data={sheetData(j)} lang={lang} L={L} schoolName={schoolName} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}

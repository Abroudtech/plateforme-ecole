import Link from "next/link";
import { CalendarHeart, ClipboardPen, NotebookPen, Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { addDays, groupAgenda, mondayOf, type AgendaItem, type AgendaKind } from "@/lib/calendar";
import { agendaScope, listEvents, listExams } from "@/lib/data/calendar";
import { parseISODate, todayISO, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/timetable";
import { ActionForm } from "@/components/action-form";
import { formatDay } from "@/components/homework-entry";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { deleteEvent, saveEvent } from "../examens/actions";

const WEEKS = 8;
const FILTERS = ["all", "exam", "homework", "event"] as const;

/** Calendrier : examens, devoirs à rendre et dates de l'école, semaine par semaine. */
export default async function CalendarPage({ params, searchParams }: PageProps<"/[lang]/calendrier">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "calendar.read");
  const c = dict.calendar;
  const schoolId = ctx.school.id;
  const today = todayISO();
  const from = parseISODate(today)!;
  const to = parseISODate(addDays(today, WEEKS * 7))!;
  const filter = FILTERS.find((f) => f === sp.voir) ?? "all";
  const isAdmin = can(ctx.roles, "events.write");
  const examLinks = can(ctx.roles, "exams.write");

  const scope = await agendaScope(ctx, lang);
  const family = ctx.roles.includes("PARENT") || ctx.roles.includes("STUDENT");
  const [exams, events, homework, levels, classes] = await Promise.all([
    listExams(schoolId, scope.classIds, from, to),
    listEvents(schoolId, scope, from, to),
    // Devoirs à rendre : pour les familles (l'enseignant les a dans le cahier de textes).
    family && scope.classIds?.length
      ? db.homework.findMany({
          where: { schoolId, classGroupId: { in: scope.classIds }, task: { not: null }, dueDate: { gte: from, lte: to } },
          include: { subject: true, classGroup: true },
          orderBy: { dueDate: "asc" },
          take: 200,
        })
      : [],
    isAdmin ? db.gradeLevel.findMany({ where: { schoolId, classGroups: { some: { academicYear: { isCurrent: true } } } }, orderBy: { rank: "asc" } }) : [],
    isAdmin ? db.classGroup.findMany({ where: { schoolId, academicYear: { isCurrent: true } }, include: { gradeLevel: true }, orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }] }) : [],
  ]);

  // Étiquette : prénom de l'enfant (parent avec plusieurs enfants) ou classe (équipe).
  const multiChild = new Set([...scope.childByClass.values()].flat()).size > 1;
  const tagFor = (cls: { id: string; name: string; nameAr: string | null }) => {
    const kids = scope.childByClass.get(cls.id);
    if (kids?.length) return multiChild ? kids.join(", ") : null;
    return family && !ctx.roles.includes("TEACHER") && !isAdmin ? null : className(cls, lang);
  };

  const items: AgendaItem[] = [
    ...exams.map((x) => ({
      key: `exam-${x.id}`,
      kind: "exam" as const,
      date: toISODate(x.date),
      title: `${pickName(x.subject, lang)} · ${dict.grades.kindsShort[x.kind]}${x.title ? ` · ${x.title}` : ""}`,
      detail: x.revision ? `${dict.exams.revision} : ${x.revision}` : null,
      tag: tagFor(x.classGroup),
      href: examLinks ? `/${lang}/examens/${x.id}` : null,
      variant: x.kind,
      time: x.startMinute != null ? formatTime(x.startMinute) : null,
    })),
    ...events.map((ev) => ({
      key: `event-${ev.id}`,
      kind: "event" as const,
      date: toISODate(ev.date),
      endDate: ev.endDate ? toISODate(ev.endDate) : null,
      title: ev.title,
      detail: ev.details,
      tag: ev.classGroup ? className(ev.classGroup, lang) : ev.gradeLevel ? pickName(ev.gradeLevel, lang) : null,
      variant: ev.kind,
    })),
    ...homework.map((h) => ({
      key: `hw-${h.id}`,
      kind: "homework" as const,
      date: toISODate(h.dueDate!),
      title: h.subject ? pickName(h.subject, lang) : dict.homework.general,
      detail: h.task,
      tag: tagFor(h.classGroup),
      href: `/${lang}/devoirs`,
    })),
  ].filter((it) => filter === "all" || it.kind === filter);
  const weeks = groupAgenda(items, today);
  const thisMonday = mondayOf(today);
  const weekTitle = (monday: string) =>
    monday === thisMonday
      ? c.thisWeek
      : monday === addDays(thisMonday, 7)
        ? c.nextWeek
        : t(c.weekOf, { date: new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${monday}T00:00:00Z`)) });

  const STYLE: Record<AgendaKind, { icon: typeof NotebookPen; ring: string; badge: string }> = {
    exam: { icon: ClipboardPen, ring: "ring-gold-300 bg-gold-50", badge: "bg-gold-500 text-blue-950" },
    event: { icon: CalendarHeart, ring: "ring-blue-200 bg-blue-50", badge: "bg-blue-900 text-white" },
    homework: { icon: NotebookPen, ring: "ring-slate-200 bg-white", badge: "bg-slate-200 text-slate-700" },
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={c.title} subtitle={isAdmin ? c.subtitleAdmin : c.subtitle} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => family || f !== "homework").map((f) => (
          <Link
            key={f}
            href={`/${lang}/calendrier${f === "all" ? "" : `?voir=${f}`}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${filter === f ? "bg-blue-900 text-white ring-blue-900" : "bg-white text-slate-700 ring-slate-200 hover:ring-gold-400"}`}
          >
            {c.filters[f]}
          </Link>
        ))}
        {examLinks && (
          <Link href={`/${lang}/examens`} className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-sm font-semibold text-blue-950 hover:bg-gold-400">
            <Plus size={15} aria-hidden /> {dict.exams.prepare}
          </Link>
        )}
      </div>

      {weeks.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-card ring-1 ring-slate-200/80">{c.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {weeks.map((w) => (
            <section key={w.monday} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{weekTitle(w.monday)}</h2>
              <ol className="flex flex-col gap-3">
                {w.days.map((d) => (
                  <li key={d.date} className="flex gap-3">
                    <div className={`w-14 shrink-0 pt-1 text-center ${d.date === today ? "text-gold-700" : "text-blue-900"}`}>
                      <p className="text-[11px] font-semibold uppercase">
                        {new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.date}T00:00:00Z`))}
                      </p>
                      <p className="text-2xl font-bold leading-none">{Number(d.date.slice(8))}</p>
                    </div>
                    <ul className="flex min-w-0 flex-1 flex-col gap-2">
                      {d.items.map((it) => {
                        const S = STYLE[it.kind];
                        const body = (
                          <>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${S.badge}`}>
                                <S.icon size={12} aria-hidden />
                                {it.kind === "event" && it.variant ? c.eventKinds[it.variant as keyof typeof c.eventKinds] : it.kind === "homework" ? c.homeworkDue : c.legend.exam}
                              </span>
                              {it.time && <span className="text-xs font-semibold text-slate-600"><bdi dir="ltr">{it.time}</bdi></span>}
                              {it.tag && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{it.tag}</span>}
                              {it.endDate && it.endDate !== it.date && <span className="text-xs text-slate-500">{t(c.until, { date: formatDay(new Date(`${it.endDate}T00:00:00Z`), lang) })}</span>}
                            </span>
                            <span className="mt-1 block font-semibold leading-snug" dir="auto">{it.title}</span>
                            {it.detail && <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap text-sm text-slate-600" dir="auto">{it.detail}</span>}
                          </>
                        );
                        const cls = `block rounded-2xl p-3 ring-1 ${S.ring}`;
                        return (
                          <li key={it.key}>
                            {it.href ? (
                              <Link href={it.href} className={`${cls} hover:ring-gold-400`}>{body}</Link>
                            ) : (
                              <div className={cls}>
                                {body}
                                {isAdmin && it.kind === "event" && (
                                  <div className="mt-2">
                                    <ActionForm action={deleteEvent.bind(null, lang, it.key.slice(6))} labels={{ ...formLabels(dict, c.removeEvent), saved: undefined }} variant="danger" confirm={c.confirmRemove} />
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {isAdmin && (
        <Card title={c.addEvent}>
          <ActionForm action={saveEvent.bind(null, lang)} labels={{ ...formLabels(dict, c.addEvent), errors: dict.formErrors as Record<string, string> }} resetOnSuccess>
            <Field label={c.eventTitle}>
              <Input name="title" required maxLength={160} dir="auto" placeholder={c.eventTitlePlaceholder} />
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label={c.eventKind}>
                <Select name="kind" defaultValue="EVENT">
                  {(Object.keys(c.eventKinds) as (keyof typeof c.eventKinds)[]).map((k) => (
                    <option key={k} value={k}>{c.eventKinds[k]}</option>
                  ))}
                </Select>
              </Field>
              <Field label={c.audience}>
                <Select name="audience" defaultValue="SCHOOL">
                  <option value="SCHOOL">{dict.messages.audiences.SCHOOL}</option>
                  {levels.map((l) => (
                    <option key={l.id} value={`level:${l.id}`}>{pickName(l, lang)}</option>
                  ))}
                  {classes.map((cl) => (
                    <option key={cl.id} value={`class:${cl.id}`}>{className(cl, lang)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={c.from}>
                <Input name="date" type="date" required defaultValue={today} />
              </Field>
              <Field label={c.to} hint={c.toHint}>
                <Input name="endDate" type="date" />
              </Field>
            </div>
            <Field label={`${c.details} (${dict.common.optional})`}>
              <Textarea name="details" rows={2} maxLength={2000} dir="auto" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="notify" className="h-4 w-4" /> {c.notify}
            </label>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, CalendarDays, ChevronRight, ClipboardList, MessageSquare, Newspaper, NotebookPen, Sparkles, Users } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import type { AppContext } from "@/lib/auth/context";
import { scopeOf, teacherOf } from "@/lib/auth/scope";
import { currentPeriod, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { countUnread, messagingViewer } from "@/lib/data/messages";
import { formatTime } from "@/lib/timetable";
import { IconBadge, Notice, Panel } from "./dashboard-ui";
import { FollowupFallback, FollowupPanel } from "./followup-panel";
import { UpcomingPanel } from "./upcoming-panel";

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

/** Jour de la semaine à Tunis : 1 = lundi ... 7 = dimanche. */
function weekday(now = new Date()) {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Tunis", weekday: "short" }).format(now);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}

/** Minutes écoulées depuis minuit, à l'heure de Tunis. */
function minutesNow(now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Tunis", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(now)
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/** Accueil de l'enseignant : cours du jour, ses classes, raccourcis. */
export async function TeacherDashboard({ ctx, lang, dict }: Props) {
  const th = dict.teacherHome;
  const schoolId = ctx.school.id;
  const teacher = await teacherOf(schoolId, ctx.user.id);
  const ids = (await scopeOf(ctx)) ?? [];
  if (!teacher) return <Notice text={th.notLinked} />;

  const today = parseISODate(todayISO())!;
  const period = currentPeriod();
  const viewer = await messagingViewer(ctx);
  const [classes, lessons, rollCalls, resources, unread] = await Promise.all([
    db.classGroup.findMany({
      where: { schoolId, id: { in: ids } },
      include: { gradeLevel: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
    }),
    db.timetableEntry.findMany({
      where: { schoolId, teacherId: teacher.id, dayOfWeek: weekday(), classGroup: { academicYear: { isCurrent: true } } },
      include: { classGroup: true, subject: true, room: true },
      orderBy: { startMinute: "asc" },
    }),
    db.rollCall.findMany({ where: { schoolId, classGroupId: { in: ids }, date: today, period } }),
    db.teachingResource.count({ where: { schoolId, authorId: ctx.user.id } }),
    countUnread(schoolId, viewer),
  ]);
  const done = new Set(rollCalls.map((r) => r.classGroupId));
  // Cours en ce moment (ou qui commence dans les 10 minutes) : l'appel en un toucher.
  const nowMin = minutesNow();
  const current = lessons.find((l) => l.startMinute - 10 <= nowMin && nowMin < l.endMinute);

  return (
    <>
      {current && (
        <section className="relative -mt-12 rounded-2xl bg-white p-4 shadow-card ring-2 ring-gold-400 md:-mt-10 md:mx-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">{th.now}</p>
          <p className="mt-1 text-lg font-bold leading-tight">
            {pickName(current.subject, lang)} · {className(current.classGroup, lang)}
          </p>
          <p className="text-sm text-slate-500">
            <bdi dir="ltr">{formatTime(current.startMinute)} – {formatTime(current.endMinute)}</bdi>
            {current.room ? ` · ${current.room.name}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/${lang}/classes/${current.classGroupId}/absences`}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${
                done.has(current.classGroupId) ? "bg-emerald-50 text-emerald-800" : "bg-blue-900 text-white"
              }`}
            >
              <CalendarCheck size={16} aria-hidden /> {done.has(current.classGroupId) ? dict.attendance.done : th.rollCallNow}
            </Link>
            <Link
              href={`/${lang}/classes/${current.classGroupId}/notes`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-blue-900 ring-1 ring-slate-200"
            >
              <ClipboardList size={16} aria-hidden /> {dict.grades.title}
            </Link>
            <Link
              href={`/${lang}/classes/${current.classGroupId}/cahier`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-blue-900 ring-1 ring-slate-200"
            >
              <NotebookPen size={16} aria-hidden /> {dict.homework.tab}
            </Link>
          </div>
        </section>
      )}
      <section className={`relative grid grid-cols-2 gap-3 sm:grid-cols-4 md:px-4 ${current ? "" : "-mt-12 md:-mt-10"}`}>
        {[
          { href: `/${lang}/atelier`, icon: Sparkles, tone: "gold" as const, label: dict.nav.workshop, extra: t(th.resources, { count: resources }) },
          { href: `/${lang}/espace-classe`, icon: Newspaper, tone: "green" as const, label: dict.nav.classSpace, extra: null },
          { href: `/${lang}/enseignants/${teacher.id}`, icon: CalendarDays, tone: "blue" as const, label: th.myTimetable, extra: null },
          { href: `/${lang}/messages`, icon: MessageSquare, tone: "blue" as const, label: dict.nav.messages, extra: unread > 0 ? `${unread} · ${dict.messages.unread}` : null },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
            <IconBadge icon={c.icon} tone={c.tone} />
            <span className="text-sm font-semibold leading-tight">{c.label}</span>
            {c.extra && <span className="text-xs text-slate-500">{c.extra}</span>}
          </Link>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <Panel title={th.today} className="md:col-span-2">
          {lessons.length === 0 ? (
            <p className="text-sm text-slate-500">{th.noLessons}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="w-[4.5rem] shrink-0 text-sm font-semibold tabular-nums text-blue-900">
                    <bdi dir="ltr">{formatTime(l.startMinute)}</bdi>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{pickName(l.subject, lang)}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {className(l.classGroup, lang)}
                      {l.room ? ` · ${l.room.name}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title={dict.nav.myClasses} className="md:col-span-3">
          {classes.length === 0 ? (
            <p className="text-sm text-slate-500">{th.noClasses}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {classes.map((c) => (
                <li key={c.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                  <Link href={`/${lang}/classes/${c.id}`} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-900 text-sm font-bold text-gold-300">
                      {className(c, lang).slice(0, 3)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{className(c, lang)}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Users size={12} aria-hidden /> {t(dict.dashboard.studentsCount, { count: c._count.enrollments })} · {pickName(c.gradeLevel, lang)}
                      </span>
                    </span>
                    <ChevronRight size={16} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
                  </Link>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/${lang}/classes/${c.id}/absences`}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${
                        done.has(c.id) ? "bg-emerald-50 text-emerald-800" : "bg-blue-900 text-white"
                      }`}
                    >
                      <CalendarCheck size={14} aria-hidden /> {done.has(c.id) ? dict.attendance.done : dict.attendance.rollCall}
                    </Link>
                    <Link
                      href={`/${lang}/classes/${c.id}/notes`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-2 py-2 text-xs font-semibold text-blue-900 ring-1 ring-slate-200"
                    >
                      <ClipboardList size={14} aria-hidden /> {dict.grades.title}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <UpcomingPanel ctx={ctx} lang={lang} dict={dict} />

      {ids.length > 0 && (
        <Suspense fallback={<FollowupFallback dict={dict} />}>
          <FollowupPanel schoolId={schoolId} classIds={ids} money={false} lang={lang} dict={dict} />
        </Suspense>
      )}
    </>
  );
}

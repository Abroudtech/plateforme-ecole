import Link from "next/link";
import { Suspense } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Newspaper,
  Settings,
  Sparkles,
  UserRound,
  Users,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { FollowupFallback, FollowupPanel } from "./followup-panel";
import { Hero, IconBadge, Initials, Panel, TONES, type Tone } from "./dashboard-ui";
import { getDirectorOverview, getSetupSteps } from "@/lib/data/director";
import { Money } from "@/components/money";
import { getCurrentYear } from "@/lib/data/school";
import { countUnread, getGuardianForUser, listAnnouncementsFor, parentScope } from "@/lib/data/messages";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requireContext, type AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getParentChildren, pendingResetRequests } from "@/lib/data/school";
import { getStudentAttendance } from "@/lib/data/attendance";
import { PushToggle } from "@/components/push-toggle";
import { db } from "@/lib/db";
import { vapidKeys } from "@/lib/push";

export default async function DashboardPage({ params }: PageProps<"/[lang]/tableau-de-bord">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const today = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Tunis" }).format(new Date());
  const hello = t(dict.dashboard.hello, { name: personName(ctx.user, lang) });

  const keys = await vapidKeys();
  // Proposition d'activer les notifications (se cache une fois activées).
  const push = <PushToggle publicKey={keys.publicKey} labels={dict.push} compact />;
  if (can(ctx.roles, "dashboard.admin")) return <AdminDashboard ctx={ctx} lang={lang} dict={dict} hello={hello} today={today} push={push} />;
  return (
    <div className="flex flex-col gap-6">
      <Hero hello={hello} line={today} overlap={can(ctx.roles, "children.read") || can(ctx.roles, "teacher.space") || can(ctx.roles, "student.space")} />
      {can(ctx.roles, "teacher.space") && <TeacherDashboard ctx={ctx} lang={lang} dict={dict} />}
      {can(ctx.roles, "children.read") && !can(ctx.roles, "teacher.space") && <ParentDashboard ctx={ctx} lang={lang} dict={dict} />}
      {can(ctx.roles, "children.read") && can(ctx.roles, "teacher.space") && (
        <Link href={`/${lang}/messages`} className="rounded-2xl bg-white p-4 text-sm font-semibold text-blue-900 shadow-card ring-1 ring-slate-200/80">
          {dict.dashboard.myChildren} · {dict.messages.myMessages}
        </Link>
      )}
      {can(ctx.roles, "student.space") && <StudentDashboard ctx={ctx} lang={lang} dict={dict} />}
      {!can(ctx.roles, "student.space") && push}
    </div>
  );
}

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

async function AdminDashboard({ ctx, lang, dict, hello, today, push }: Props & { hello: string; today: string; push: React.ReactNode }) {
  const [o, setup, resets] = await Promise.all([
    getDirectorOverview(ctx.school.id, ctx.user.id),
    getSetupSteps(ctx.school),
    pendingResetRequests(ctx.school.id),
  ]);
  const notesToReview = await db.absenceNote.count({ where: { schoolId: ctx.school.id, status: "PENDING" } });
  const setupLeft = setup.filter((x) => !x.done).length;
  const d = dict.director;
  const termName = o.currentTerm ? (lang === "ar" ? o.currentTerm.nameAr : o.currentTerm.nameFr) : "";
  const className = (c: { name: string; nameAr: string | null }) => (lang === "ar" && c.nameAr ? c.nameAr : c.name);
  const rate = o.money.rateToDate;
  const todo = [
    o.classesWithoutRollCall.length > 0 && {
      href: `/${lang}/absences`,
      icon: CalendarCheck,
      tone: "red",
      text: t(d.todoRollCall, { count: o.classesWithoutRollCall.length }),
      detail: o.classesWithoutRollCall.map(className).join(", "),
    },
    o.money.overdueCount > 0 && { href: `/${lang}/paiements`, icon: Wallet, tone: "gold", text: t(d.todoOverdue, { count: o.money.overdueCount }), detail: null, amount: o.money.overdue },
    o.unpublished.length > 0 && {
      href: `/${lang}/classes/${o.unpublished[0].id}/bulletins`,
      icon: FileText,
      tone: "blue",
      text: t(d.todoReports, { count: o.unpublished.length, term: termName }),
      detail: o.unpublished.map(className).join(", "),
    },
    notesToReview > 0 && { href: `/${lang}/absences`, icon: CalendarCheck, tone: "gold", text: t(dict.absenceNotes.todo, { count: notesToReview }), detail: null },
    resets.length > 0 && { href: `/${lang}/acces`, icon: UserRound, tone: "blue", text: t(dict.reset.todo, { count: resets.length }), detail: null },
    o.unread > 0 && { href: `/${lang}/messages`, icon: MessageSquare, tone: "green", text: t(d.todoMessages, { count: o.unread }), detail: null },
  ].filter(Boolean) as { href: string; icon: LucideIcon; tone: Tone; text: string; detail: string | null; amount?: number }[];

  const line = (
    <>
      {today}
      {o.year && (
        <>
          {" · "}
          <bdi dir="ltr">{o.year.label}</bdi>
        </>
      )}
      {termName && ` · ${termName}`}
    </>
  );
  const chip = o.isSchoolDay && o.classCount > 0 && (
    <Link
      href={`/${lang}/absences`}
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${o.rollCallsDone < o.classCount ? "bg-gold-500/20 text-gold-200" : "bg-emerald-400/15 text-emerald-200"}`}
    >
      <ClipboardCheck size={16} aria-hidden />
      {t(d.rollCallsChip, { done: o.rollCallsDone, total: o.classCount })}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <Hero hello={hello} line={o.year ? line : <>{today} · {dict.dashboard.noCurrentYear}</>} chip={chip} overlap />

      <section className="relative -mt-[4.25rem] grid grid-cols-2 gap-3 md:-mt-20 md:grid-cols-4 md:px-4">
        <Kpi href={`/${lang}/eleves`} icon={Users} tone="blue" label={dict.dashboard.students} value={String(o.studentCount)} sub={t(d.classesCount, { count: o.classCount })} />
        <Kpi href={`/${lang}/absences`} icon={UserX} tone="red" label={d.absentToday} value={String(o.absentToday)} sub={o.lateToday ? t(d.late, { count: o.lateToday }) : d.today} />
        <Kpi href={`/${lang}/paiements`} icon={Wallet} tone="gold" label={d.collected} value={rate == null ? "—" : `${Math.round(rate * 100)} %`} sub={d.ofDue} />
        <Kpi href={`/${lang}/messages`} icon={MessageSquare} tone="green" label={dict.nav.messages} value={String(o.unread)} sub={d.unreadShort} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:px-4">
        <Link href={`/${lang}/recherche?pour=paiement`} className="flex items-center gap-3 rounded-2xl bg-blue-900 p-3.5 text-sm font-semibold text-white shadow-card hover:bg-blue-800">
          <Wallet size={20} className="shrink-0 text-gold-300" aria-hidden /> {d.actionPayment}
        </Link>
        <Link href={`/${lang}/absences`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-semibold text-blue-900 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
          <CalendarCheck size={20} className="shrink-0" aria-hidden /> {d.actionAbsences}
        </Link>
        <Link href={`/${lang}/eleves/nouveau`} className="col-span-2 flex items-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-semibold text-blue-900 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400 md:col-span-1">
          <Users size={20} className="shrink-0" aria-hidden /> {dict.students.add}
        </Link>
      </section>

      {setupLeft > 0 && (
        <Panel title={t(dict.setup.title, { done: setup.length - setupLeft, total: setup.length })}>
          <ol className="flex flex-col gap-1.5">
            {setup.map((x, i) => (
              <li key={x.key}>
                <Link
                  href={`/${lang}/${x.href}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${x.done ? "text-slate-500" : "bg-slate-50 font-semibold hover:bg-gold-50"}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${x.done ? "bg-emerald-100 text-emerald-700" : "bg-blue-900 text-white"}`}>
                    {x.done ? <CircleCheck size={14} aria-hidden /> : i + 1}
                  </span>
                  <span className={x.done ? "line-through" : ""}>{dict.setup.steps[x.key]}</span>
                  {!x.done && <ChevronRight size={16} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />}
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {o.studentCount === 0 && (
        <Link href={`/${lang}/importer`} className="flex items-center gap-3 rounded-2xl bg-gold-50 p-4 text-sm text-gold-900 ring-1 ring-gold-200 hover:bg-gold-100">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500 text-blue-900"><FileSpreadsheet size={20} aria-hidden /></span>
          <span><span className="block font-semibold">{dict.importer.shortcut}</span>{dict.importer.tip}</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Panel title={d.todo} className="lg:col-span-3">
          {todo.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CircleCheck size={18} aria-hidden /> {d.allGood}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todo.map((x) => (
                <li key={x.text}>
                  <Link href={x.href} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <IconBadge icon={x.icon} tone={x.tone} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">{x.text}</span>
                      {x.detail && <span className="block truncate text-sm text-slate-500">{x.detail}</span>}
                      {x.amount != null && <Money value={x.amount} lang={lang} className="block text-sm font-medium text-red-700" />}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:text-blue-900 rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!o.isSchoolDay && <p className="mt-3 text-xs text-slate-500">{d.noSchoolDay}</p>}
        </Panel>

        <Panel title={d.money} className="lg:col-span-2">
          <div className="flex items-center gap-5">
            <Ring value={rate} />
            <dl className="flex flex-col gap-2 text-sm">
              <div><dt className="text-slate-500">{d.thisMonth}</dt><dd className="text-lg font-bold"><Money value={o.money.month} lang={lang} /></dd></div>
              <div><dt className="text-slate-500">{d.sinceStart}</dt><dd className="text-lg font-bold"><Money value={o.money.year} lang={lang} /></dd></div>
            </dl>
          </div>
          {o.money.overdue > 0 && (
            <Link href={`/${lang}/paiements`} className="mt-4 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <span>{d.overdueAmount}</span>
              <Money value={o.money.overdue} lang={lang} className="font-bold" />
            </Link>
          )}
        </Panel>

        <Panel title={termName ? t(d.averages, { term: termName }) : t(d.results, { term: "" })} className="lg:col-span-3">
          {o.results.length === 0 ? (
            <p className="text-sm text-slate-500">{d.noResults}</p>
          ) : (
            <>
              <div className="flex h-44 items-end gap-2 overflow-x-auto pt-6 pb-1" dir="ltr">
                {o.results.map((r) => (
                  <Link key={r.cls.id} href={`/${lang}/classes/${r.cls.id}/bulletins`} className="group flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1" title={r.below > 0 ? t(d.below, { count: r.below }) : undefined}>
                    <span className="text-[11px] font-bold tabular-nums">{r.mean.toFixed(1).replace(".", lang === "fr" ? "," : ".")}</span>
                    <span
                      className={`w-full max-w-14 rounded-t-lg rounded-b-sm transition group-hover:opacity-80 ${r.mean >= 12 ? "bg-blue-900" : r.mean >= 10 ? "bg-blue-500" : "bg-gold-500"}`}
                      style={{ height: `${Math.max(6, (r.mean / 20) * 100)}%` }}
                    />
                    <span className="max-w-full truncate text-xs font-semibold text-slate-500">{className(r.cls)}</span>
                  </Link>
                ))}
              </div>
              {o.results.some((r) => r.below > 0) && (
                <p className="mt-3 text-xs text-slate-500">
                  {o.results.filter((r) => r.below > 0).map((r) => `${className(r.cls)} : ${t(d.below, { count: r.below })}`).join(" · ")}
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel title={d.absences30} className="lg:col-span-2">
          <p className="mb-3 text-sm text-slate-600">{t(d.absencesTotal, { total: o.absences30.total, unjustified: o.absences30.unjustified })}</p>
          {o.absences30.mostAbsent.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {o.absences30.mostAbsent.map((a) => (
                <li key={a.student.id}>
                  <Link href={`/${lang}/eleves/${a.student.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-gold-50">
                    <Initials name={personName(a.student, lang)} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{personName(a.student, lang)}</span>
                      <span className="text-slate-500"> · {className(a.cls)}</span>
                    </span>
                    <span className={`shrink-0 text-xs ${a.unjustified > 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>{t(d.halfDays, { total: a.total, unjustified: a.unjustified })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Suspense fallback={<FollowupFallback dict={dict} />}>
        <FollowupPanel schoolId={ctx.school.id} classIds={null} money={can(ctx.roles, "payments.read")} lang={lang} dict={dict} />
      </Suspense>

      {push}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-blue-900">{d.quick}</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {QUICK.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <Link href={`/${lang}/${href}`} className="flex h-full flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-900"><Icon size={20} aria-hidden /></span>
                <span className="text-xs font-semibold leading-tight">{key === "settings" || key === "workshop" || key === "classSpace" ? dict.nav[key] : dict.modules[key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const QUICK = [
  { key: "students", href: "eleves", icon: Users },
  { key: "classes", href: "classes", icon: BookOpen },
  { key: "attendance", href: "absences", icon: CalendarCheck },
  { key: "timetable", href: "emplois-du-temps", icon: CalendarDays },
  { key: "teachers", href: "enseignants", icon: GraduationCap },
  { key: "payments", href: "paiements", icon: Wallet },
  { key: "messages", href: "messages", icon: MessageSquare },
  { key: "reportCards", href: "classes", icon: FileText },
  { key: "workshop", href: "atelier", icon: Sparkles },
  { key: "classSpace", href: "espace-classe", icon: Newspaper },
  { key: "settings", href: "parametres", icon: Settings },
] as const;

function Kpi({ href, icon: Icon, tone, label, value, sub }: { href: string; icon: LucideIcon; tone: Tone; label: string; value: string; sub?: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-slate-200/80 transition hover:ring-gold-400 sm:p-4">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${TONES[tone]}`}><Icon size={16} aria-hidden /></span>
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-2 block text-[1.7rem] leading-none font-bold tracking-tight tabular-nums"><bdi dir="ltr">{value}</bdi></span>
      {sub && <span className="mt-1.5 block truncate text-xs text-slate-500">{sub}</span>}
    </Link>
  );
}

/** Anneau de progression (taux d'encaissement). */
function Ring({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.round(Math.min(1, value) * 100);
  return (
    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-blue-900) 0 ${pct}%, var(--color-slate-100) ${pct}% 100%)` }}>
      <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white text-lg font-bold">
        <bdi dir="ltr">{value == null ? "—" : `${pct}%`}</bdi>
      </div>
    </div>
  );
}

async function ParentDashboard({ ctx, lang, dict }: Props) {
  const children = await getParentChildren(ctx.school.id, ctx.user.id);
  const attendance = new Map(
    await Promise.all(children.map(async (c) => [c.id, await getStudentAttendance(ctx.school.id, c.id)] as const)),
  );
  const guardian = await getGuardianForUser(ctx.school.id, ctx.user.id);
  const year = await getCurrentYear(ctx.school.id);
  const [unread, announcements] = guardian
    ? await Promise.all([
        countUnread(ctx.school.id, { userId: ctx.user.id, schoolSide: false, guardianId: guardian.id, teacherId: null }),
        listAnnouncementsFor(ctx.school.id, await parentScope(ctx.school.id, guardian.id, year?.id ?? null), 2),
      ])
    : [0, []];
  return (
    <>
    <section className="relative -mt-12 grid grid-cols-3 gap-3 md:-mt-10 md:px-4">
      {[
        { href: `/${lang}/messages`, icon: MessageSquare, tone: "green" as Tone, label: dict.messages.myMessages, extra: unread > 0 ? `${unread} · ${dict.messages.unread}` : null },
        { href: `/${lang}/annonces`, icon: Megaphone, tone: "gold" as Tone, label: dict.messages.announcements, extra: announcements[0]?.title ?? null },
        { href: `/${lang}/mon-compte`, icon: UserRound, tone: "blue" as Tone, label: dict.account.title, extra: null },
      ].map((c) => (
        <Link key={c.href} href={c.href} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
          <IconBadge icon={c.icon} tone={c.tone} />
          <span className="text-sm font-semibold leading-tight">{c.label}</span>
          {c.extra && <span className="line-clamp-2 text-xs text-slate-500" dir="auto">{c.extra}</span>}
        </Link>
      ))}
    </section>
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-blue-900">{dict.dashboard.myChildren}</h2>
      {children.length === 0 ? (
        <p className="text-slate-600">{dict.dashboard.noChildren}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {children.map((child) => {
            const enrollment = child.enrollments[0];
            return (
              <li key={child.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
                <div className="flex items-center gap-3">
                  <Initials name={personName(child, lang)} />
                  <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{personName(child, lang)}</p>
                <p className="text-sm text-slate-600">
                  {enrollment
                    ? `${pickName(enrollment.classGroup.gradeLevel, lang)} · ${lang === "ar" && enrollment.classGroup.nameAr ? enrollment.classGroup.nameAr : enrollment.classGroup.name}`
                    : dict.dashboard.notEnrolled}
                </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {dict.attendance.title} : {t(dict.attendance.summary, attendance.get(child.id)!.summary)}
                </p>
                {attendance.get(child.id)!.records.length > 0 && (
                  <ul className="mt-1 text-xs text-slate-500">
                    {attendance.get(child.id)!.records.slice(0, 3).map((r) => (
                      <li key={r.id}>
                        {new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", timeZone: "UTC" }).format(r.date)}
                        {" · "}{dict.attendance.periods[r.period]} · {dict.attendance.statuses[r.status]}
                        {r.justified ? ` (${dict.attendance.justified})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {enrollment && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ctx.school.showGradesToParents && (
                      <Link href={`/${lang}/eleves/${child.id}/notes`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                        {dict.progress.myGrades}
                      </Link>
                    )}
                    <Link href={`/${lang}/eleves/${child.id}/bulletin`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                      {dict.reportCards.myBulletins}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/devoirs`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                      {dict.homework.myHomework}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/absences`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                      {dict.attendance.title}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/paiements`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                      {dict.payments.myPayments}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/emploi-du-temps`} className="inline-block rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gold-100">
                      {dict.timetable.myTimetable}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
    </>
  );
}


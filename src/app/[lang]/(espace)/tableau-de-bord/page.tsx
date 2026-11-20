import Link from "next/link";
import { getDirectorOverview } from "@/lib/data/director";
import { formatMoney } from "@/lib/payments";
import { Money } from "@/components/money";
import { getCurrentYear } from "@/lib/data/school";
import { countUnread, getGuardianForUser, listAnnouncementsFor, parentScope } from "@/lib/data/messages";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requireContext, type AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getParentChildren } from "@/lib/data/school";
import { getStudentAttendance } from "@/lib/data/attendance";

/** Modules déjà disponibles (les autres affichent "Bientôt"). */
const MODULE_LINKS: Partial<Record<string, string>> = { students: "eleves", classes: "classes", grades: "classes", reportCards: "classes", attendance: "absences", payments: "paiements", messages: "messages", timetable: "emplois-du-temps", teachers: "enseignants" };

export default async function DashboardPage({ params }: PageProps<"/[lang]/tableau-de-bord">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">
        {t(dict.dashboard.hello, { name: personName(ctx.user, lang) })}
      </h1>

      {can(ctx.roles, "dashboard.admin") && <AdminDashboard ctx={ctx} lang={lang} dict={dict} />}
      {can(ctx.roles, "children.read") && <ParentDashboard ctx={ctx} lang={lang} dict={dict} />}
      {ctx.roles.includes("TEACHER") && <Notice text={dict.dashboard.teacherSoon} />}
      {ctx.roles.includes("STUDENT") && <Notice text={dict.dashboard.studentSoon} />}
    </div>
  );
}

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

async function AdminDashboard({ ctx, lang, dict }: Props) {
  const o = await getDirectorOverview(ctx.school.id, ctx.user.id);
  const d = dict.director;
  const termName = o.currentTerm ? (lang === "ar" ? o.currentTerm.nameAr : o.currentTerm.nameFr) : "";
  const modules = ["students", "classes", "grades", "reportCards", "attendance", "timetable", "teachers", "payments", "messages"] as const;
  const className = (c: { name: string; nameAr: string | null }) => (lang === "ar" && c.nameAr ? c.nameAr : c.name);
  const todo = [
    o.classesWithoutRollCall.length > 0 && {
      href: `/${lang}/absences`,
      text: t(d.todoRollCall, { count: o.classesWithoutRollCall.length }),
      detail: o.classesWithoutRollCall.map(className).join(", "),
    },
    o.unpublished.length > 0 && {
      href: `/${lang}/classes/${o.unpublished[0].id}/bulletins`,
      text: t(d.todoReports, { count: o.unpublished.length, term: termName }),
      detail: o.unpublished.map(className).join(", "),
    },
    o.money.overdueCount > 0 && { href: `/${lang}/paiements`, text: t(d.todoOverdue, { count: o.money.overdueCount }), detail: null, amount: o.money.overdue },
    o.unread > 0 && { href: `/${lang}/messages`, text: t(d.todoMessages, { count: o.unread }), detail: null },
  ].filter(Boolean) as { href: string; text: string; detail: string | null; amount?: number }[];

  return (
    <>
      <p className="-mt-6 text-slate-600">
        {o.year ? (
          <>
            {t(dict.dashboard.currentYear, { year: "" })}
            <bdi dir="ltr">{o.year.label}</bdi>
            {termName && ` · ${termName}`}
          </>
        ) : (
          dict.dashboard.noCurrentYear
        )}
      </p>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label={dict.dashboard.students} value={String(o.studentCount)} href={`/${lang}/eleves`} />
        <Tile label={d.absentToday} value={String(o.absentToday)} sub={o.lateToday ? `${o.lateToday} ${d.lateToday.toLowerCase()}` : undefined} href={`/${lang}/absences`} />
        <Tile label={d.rollCalls} value={o.isSchoolDay ? `${o.rollCallsDone} / ${o.classCount}` : "—"} href={`/${lang}/absences`} tone={o.isSchoolDay && o.rollCallsDone < o.classCount ? "warn" : undefined} />
        <Tile label={d.collectionRate} value={o.money.rateToDate == null ? "—" : `${Math.round(o.money.rateToDate * 100)} %`} href={`/${lang}/paiements`} />
        <Tile label={d.overdueAmount} value={formatMoney(o.money.overdue, lang)} href={`/${lang}/paiements`} tone={o.money.overdue > 0 ? "bad" : undefined} small />
        <Tile label={d.unread} value={String(o.unread)} href={`/${lang}/messages`} tone={o.unread > 0 ? "warn" : undefined} />
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-semibold">{d.todo}</h2>
        {todo.length === 0 ? (
          <p className="text-sm text-green-700">{d.allGood}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todo.map((x) => (
              <li key={x.text}>
                <Link href={x.href} className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200 hover:bg-amber-100">
                  <span className="min-w-0">
                    <span className="font-medium text-amber-900">{x.text}</span>
                    {x.detail && <span className="block truncate text-sm text-amber-800">{x.detail}</span>}
                  </span>
                  {x.amount != null && <Money value={x.amount} lang={lang} className="shrink-0 font-semibold text-red-700" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!o.isSchoolDay && <p className="mt-2 text-xs text-slate-500">{d.noSchoolDay}</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">{t(d.results, { term: termName })}</h2>
          {o.results.length === 0 ? (
            <p className="text-sm text-slate-500">{d.noResults}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {o.results.map((r) => (
                <li key={r.cls.id}>
                  <Link href={`/${lang}/classes/${r.cls.id}/bulletins`} className="block hover:opacity-80">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{className(r.cls)}</span>
                      <span className="text-slate-600">
                        <bdi dir="ltr" className="font-semibold text-slate-900">{r.mean.toFixed(2)}</bdi>
                        {r.below > 0 && <span className="ms-2 text-red-700">{t(d.below, { count: r.below })}</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" dir="ltr">
                      <div className={`h-full rounded-full ${r.mean >= 10 ? "bg-blue-600" : "bg-red-500"}`} style={{ width: `${Math.min(100, (r.mean / 20) * 100)}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-1 text-lg font-semibold">{d.absences30}</h2>
          <p className="mb-3 text-sm text-slate-600">{t(d.absencesTotal, { total: o.absences30.total, unjustified: o.absences30.unjustified })}</p>
          {o.absences30.mostAbsent.length > 0 && (
            <>
              <h3 className="mb-2 text-sm font-medium text-slate-500">{d.mostAbsent}</h3>
              <ul className="flex flex-col gap-1.5">
                {o.absences30.mostAbsent.map((a) => (
                  <li key={a.student.id}>
                    <Link href={`/${lang}/eleves/${a.student.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-blue-50">
                      <span>
                        <span className="font-medium">{personName(a.student, lang)}</span>
                        <span className="text-slate-500"> · {className(a.cls)}</span>
                      </span>
                      <span className={a.unjustified > 0 ? "text-red-700" : "text-slate-600"}>{t(d.halfDays, { total: a.total, unjustified: a.unjustified })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">{d.money}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MoneyTile label={d.thisMonth} value={o.money.month} lang={lang} />
            <MoneyTile label={d.sinceStart} value={o.money.year} lang={lang} />
            <MoneyTile label={dict.payments.totalDue} value={o.money.due} lang={lang} />
            <MoneyTile label={d.overdueAmount} value={o.money.overdue} lang={lang} bad={o.money.overdue > 0} />
          </div>
          {o.money.due > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" dir="ltr">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.round((o.money.paid / o.money.due) * 100)}%` }} />
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{d.quick}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {modules.map((m) => (
            <li key={m}>
              <Link href={`/${lang}/${MODULE_LINKS[m]}`} className="block h-full rounded-xl bg-white p-3 ring-1 ring-blue-200 hover:bg-blue-50">
                <p className="font-medium text-blue-800">{dict.modules[m]}</p>
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/${lang}/parametres`} className="block h-full rounded-xl bg-white p-3 ring-1 ring-blue-200 hover:bg-blue-50">
              <p className="font-medium text-blue-800">{dict.nav.settings}</p>
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}

function Tile({ label, value, sub, href, tone, small }: { label: string; value: string; sub?: string; href: string; tone?: "warn" | "bad"; small?: boolean }) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <Link href={href} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 hover:bg-slate-50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${small ? "text-base" : "text-2xl"} ${color}`}>
        <bdi dir="ltr">{value}</bdi>
      </p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Link>
  );
}

function MoneyTile({ label, value, lang, bad }: { label: string; value: number; lang: Locale; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${bad ? "text-red-700" : ""}`}><Money value={value} lang={lang} /></p>
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
        countUnread(ctx.school.id, ctx.user.id, guardian.id),
        listAnnouncementsFor(ctx.school.id, await parentScope(ctx.school.id, guardian.id, year?.id ?? null), 2),
      ])
    : [0, []];
  return (
    <>
    <section className="mb-6 grid grid-cols-3 gap-3">
      <Link href={`/${lang}/messages`} className="rounded-xl bg-white p-4 ring-1 ring-blue-200 hover:bg-blue-50">
        <p className="font-medium text-blue-800">{dict.messages.myMessages}</p>
        {unread > 0 && <p className="mt-1 inline-block rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white">{unread} · {dict.messages.unread}</p>}
      </Link>
      <Link href={`/${lang}/annonces`} className="rounded-xl bg-white p-4 ring-1 ring-blue-200 hover:bg-blue-50">
        <p className="font-medium text-blue-800">{dict.messages.announcements}</p>
        {announcements[0] && <p className="mt-1 line-clamp-2 text-sm text-slate-600" dir="auto">{announcements[0].title}</p>}
      </Link>
      <Link href={`/${lang}/mon-compte`} className="rounded-xl bg-white p-4 ring-1 ring-blue-200 hover:bg-blue-50">
        <p className="font-medium text-blue-800">{dict.account.title}</p>
      </Link>
    </section>
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{dict.dashboard.myChildren}</h2>
      {children.length === 0 ? (
        <p className="text-slate-600">{dict.dashboard.noChildren}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {children.map((child) => {
            const enrollment = child.enrollments[0];
            return (
              <li key={child.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-lg font-semibold">{personName(child, lang)}</p>
                <p className="text-sm text-slate-600">
                  {enrollment
                    ? `${pickName(enrollment.classGroup.gradeLevel, lang)} · ${lang === "ar" && enrollment.classGroup.nameAr ? enrollment.classGroup.nameAr : enrollment.classGroup.name}`
                    : dict.dashboard.notEnrolled}
                </p>
                <p className="mt-2 text-sm text-slate-600">
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
                    <Link href={`/${lang}/eleves/${child.id}/bulletin`} className="inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
                      {dict.reportCards.myBulletins}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/paiements`} className="inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
                      {dict.payments.myPayments}
                    </Link>
                    <Link href={`/${lang}/eleves/${child.id}/emploi-du-temps`} className="inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
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


function Notice({ text }: { text: string }) {
  return <p className="rounded-xl bg-blue-50 p-4 text-blue-900">{text}</p>;
}

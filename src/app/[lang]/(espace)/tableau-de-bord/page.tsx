import Link from "next/link";
import { getCurrentYear } from "@/lib/data/school";
import { countUnread, getGuardianForUser, listAnnouncementsFor, parentScope } from "@/lib/data/messages";
import { getSchoolAccounts } from "@/lib/data/payments";
import type { Cycle } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requireContext, type AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getAdminOverview, getParentChildren } from "@/lib/data/school";
import { countAbsences, getStudentAttendance } from "@/lib/data/attendance";
import { parseISODate, todayISO } from "@/lib/dates";

const CYCLES: Cycle[] = ["PRIMARY", "MIDDLE", "SECONDARY"];

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
  const { year, studentCount, levelCount, classes } = await getAdminOverview(ctx.school.id);
  const overdueCount = year
    ? (await getSchoolAccounts(ctx.school.id, year.id, todayISO())).filter((r) => r.account.overdue > 0).length
    : 0;
  const absentToday = await countAbsences(ctx.school.id, parseISODate(todayISO())!);
  const cycles = CYCLES.filter((c) => ctx.school.cycles.includes(c));
  const modules = ["students", "classes", "grades", "reportCards", "attendance", "timetable", "teachers", "payments", "messages"] as const;

  return (
    <>
      <p className="-mt-6 text-slate-600">
        {year ? (
          <>
            {t(dict.dashboard.currentYear, { year: "" })}
            <bdi dir="ltr">{year.label}</bdi>
          </>
        ) : (
          dict.dashboard.noCurrentYear
        )}
      </p>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label={dict.dashboard.students} value={studentCount} />
        <Stat label={dict.dashboard.classes} value={classes.length} />
        <Stat label={dict.dashboard.levels} value={levelCount} />
        <Link href={`/${lang}/absences`}>
          <Stat label={dict.attendance.todayCount} value={absentToday} />
        </Link>
        <Link href={`/${lang}/paiements`}>
          <Stat label={dict.payments.overdue} value={overdueCount} />
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{dict.dashboard.byCycle}</h2>
        {cycles.map((cycle) => {
          const list = classes.filter((c) => c.gradeLevel.cycle === cycle);
          return (
            <div key={cycle} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <h3 className="mb-3 font-semibold text-blue-800">{dict.cycles[cycle]}</h3>
              {list.length === 0 ? (
                <p className="text-sm text-slate-500">{dict.dashboard.noClasses}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((c) => (
                    <li key={c.id}>
                      <Link href={`/${lang}/classes/${c.id}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-blue-50">
                        <span>
                          <span className="font-medium">{lang === "ar" && c.nameAr ? c.nameAr : c.name}</span>
                          <span className="ms-2 text-sm text-slate-500">
                            {pickName(c.gradeLevel, lang)}
                            {c.track ? ` · ${pickName(c.track, lang)}` : ""}
                          </span>
                        </span>
                        <span className="text-sm text-slate-600">
                          {t(dict.dashboard.studentsCount, { count: c._count.enrollments })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{dict.dashboard.modules}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {modules.map((m) => {
            const href = MODULE_LINKS[m];
            return (
              <li key={m}>
                {href ? (
                  <Link href={`/${lang}/${href}`} className="block h-full rounded-xl bg-white p-3 ring-1 ring-blue-200 hover:bg-blue-50">
                    <p className="font-medium text-blue-800">{dict.modules[m]}</p>
                  </Link>
                ) : (
                  <div className="h-full rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="font-medium">{dict.modules[m]}</p>
                    <p className="text-xs text-slate-500">{dict.dashboard.comingSoon}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
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
    <section className="mb-6 grid grid-cols-2 gap-3">
      <Link href={`/${lang}/messages`} className="rounded-xl bg-white p-4 ring-1 ring-blue-200 hover:bg-blue-50">
        <p className="font-medium text-blue-800">{dict.messages.myMessages}</p>
        {unread > 0 && <p className="mt-1 inline-block rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white">{unread} · {dict.messages.unread}</p>}
      </Link>
      <Link href={`/${lang}/annonces`} className="rounded-xl bg-white p-4 ring-1 ring-blue-200 hover:bg-blue-50">
        <p className="font-medium text-blue-800">{dict.messages.announcements}</p>
        {announcements[0] && <p className="mt-1 line-clamp-2 text-sm text-slate-600" dir="auto">{announcements[0].title}</p>}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-slate-200">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-xl bg-blue-50 p-4 text-blue-900">{text}</p>;
}

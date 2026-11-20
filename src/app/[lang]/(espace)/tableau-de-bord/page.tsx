import Link from "next/link";
import type { Cycle } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requireContext, type AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getAdminOverview, getParentChildren } from "@/lib/data/school";

const CYCLES: Cycle[] = ["PRIMARY", "MIDDLE", "SECONDARY"];

/** Modules déjà disponibles (les autres affichent "Bientôt"). */
const MODULE_LINKS: Partial<Record<string, string>> = { students: "eleves", classes: "classes" };

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
  const cycles = CYCLES.filter((c) => ctx.school.cycles.includes(c));
  const modules = ["students", "classes", "grades", "reportCards", "attendance", "payments", "messages"] as const;

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

      <section className="grid grid-cols-3 gap-3">
        <Stat label={dict.dashboard.students} value={studentCount} />
        <Stat label={dict.dashboard.classes} value={classes.length} />
        <Stat label={dict.dashboard.levels} value={levelCount} />
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
  return (
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scopeOf, teacherOf } from "@/lib/auth/scope";
import { parseISODate, todayISO, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import { addDays, mondayOf, schoolWeek } from "@/lib/journal";
import { Card, PageHeader } from "@/components/ui";

/**
 * Journal de classe : la semaine, classe par classe. L'enseignant voit ses
 * journées et remplit celle du jour ; la direction voit ce qui est rempli.
 */
export default async function JournalHome({ params, searchParams }: PageProps<"/[lang]/journal">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const L = dict.journal;
  const ctx = await requirePermission(lang, "journal.read");
  const schoolId = ctx.school.id;
  const isAdmin = ctx.roles.includes("ADMIN");
  const canWrite = can(ctx.roles, "journal.write");
  const teacher = canWrite ? await teacherOf(schoolId, ctx.user.id) : null;

  const today = todayISO();
  const asked = typeof sp.semaine === "string" && parseISODate(sp.semaine) ? sp.semaine : today;
  const monday = mondayOf(asked);
  const days = schoolWeek(monday);

  const [year, ids] = await Promise.all([getCurrentYear(schoolId), scopeOf(ctx)]);
  const classes = await db.classGroup.findMany({
    where: { schoolId, academicYearId: year?.id ?? "__aucune__", ...(ids ? { id: { in: ids } } : {}) },
    include: { gradeLevel: true },
    orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
  });
  const journals = await db.classJournal.findMany({
    where: {
      schoolId,
      classGroupId: { in: classes.map((c) => c.id) },
      date: { gte: parseISODate(days[0])!, lte: parseISODate(days[5])! },
      ...(isAdmin ? {} : { authorId: ctx.user.id }),
    },
    select: { classGroupId: true, date: true, authorId: true },
  });
  const filled = new Map<string, number>();
  for (const j of journals) {
    const k = `${j.classGroupId}|${toISODate(j.date)}`;
    filled.set(k, (filled.get(k) ?? 0) + 1);
  }
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const base = `/${lang}/journal`;
  const dayHref = (classId: string, d: string) => `${base}/${classId}?date=${d}`;
  const mineToday = (cid: string) => journals.some((j) => j.classGroupId === cid && toISODate(j.date) === today && j.authorId === ctx.user.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={L.title} subtitle={isAdmin ? L.adminIntro : L.intro} />

      {canWrite && !teacher && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{L.notTeacher}</p>}

      {canWrite && teacher && classes.length > 0 && (
        <Card title={`${L.today} · ${long.format(parseISODate(today)!)}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((c) => {
              const done = mineToday(c.id);
              return (
                <Link
                  key={c.id}
                  href={dayHref(c.id, today)}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold ${done ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-blue-900 text-white"}`}
                >
                  <span className="min-w-0 truncate">
                    {className(c, lang)} <span className="font-normal opacity-80">· {pickName(c.gradeLevel, lang)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm">
                    {done ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {done ? L.filled : L.fill}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`${base}?semaine=${addDays(monday, -7)}`} className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label={L.prevWeek} title={L.prevWeek}>
            <ChevronLeft size={18} className="rtl:rotate-180" aria-hidden />
          </Link>
          <p className="text-center font-bold text-blue-900">{t(L.weekOf, { date: long.format(parseISODate(monday)!) })}</p>
          <Link href={`${base}?semaine=${addDays(monday, 7)}`} className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label={L.nextWeek} title={L.nextWeek}>
            <ChevronRight size={18} className="rtl:rotate-180" aria-hidden />
          </Link>
        </div>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-500">{L.noClasses}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="text-start font-semibold text-slate-500">{L.class}</th>
                  {days.map((d) => (
                    <th key={d} className={`px-1 text-center text-xs font-semibold capitalize ${d === today ? "text-blue-900" : "text-slate-500"}`}>
                      {fmt.format(parseISODate(d)!)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap pe-2 font-semibold">{className(c, lang)}</td>
                    {days.map((d) => {
                      const n = filled.get(`${c.id}|${d}`) ?? 0;
                      return (
                        <td key={d} className="p-0 text-center">
                          <Link
                            href={dayHref(c.id, d)}
                            className={`mx-auto grid h-9 min-w-9 place-items-center rounded-lg text-xs font-bold ${
                              n > 0 ? "bg-emerald-100 text-emerald-800" : d === today ? "bg-white ring-2 ring-blue-300" : "bg-slate-50 text-slate-300 ring-1 ring-slate-200"
                            }`}
                            aria-label={`${className(c, lang)} · ${fmt.format(parseISODate(d)!)}${n > 0 ? ` · ${L.filled}` : ""}`}
                          >
                            {n > 0 ? (n > 1 ? n : <Check size={16} aria-hidden />) : "·"}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

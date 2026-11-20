import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import { listClasses } from "@/lib/data/classes";
import { Card, PageHeader } from "@/components/ui";

/** Point d'entrée : emplois du temps des classes, enseignants et salles. */
export default async function TimetablesPage({ params }: PageProps<"/[lang]/emplois-du-temps">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const year = await getCurrentYear(ctx.school.id);
  const classes = year ? await listClasses(ctx.school.id, year.id) : [];
  const counts = await db.timetableEntry.groupBy({
    by: ["classGroupId"],
    where: { schoolId: ctx.school.id, classGroupId: { in: classes.map((c) => c.id) } },
    _count: true,
  });
  const countOf = new Map(counts.map((c) => [c.classGroupId, c._count]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={dict.timetable.title} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/${lang}/enseignants`} className="rounded-xl bg-white p-4 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50">
          {dict.teachers.title}
        </Link>
        <Link href={`/${lang}/salles`} className="rounded-xl bg-white p-4 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50">
          {dict.rooms.title}
        </Link>
      </div>
      <Card title={dict.timetable.classes}>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.dashboard.noClasses}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/classes/${c.id}/emploi-du-temps`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3 hover:bg-blue-50"
                >
                  <span className="font-semibold">{lang === "ar" && c.nameAr ? c.nameAr : c.name}</span>
                  <span className="text-sm text-slate-500">{countOf.get(c.id) ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

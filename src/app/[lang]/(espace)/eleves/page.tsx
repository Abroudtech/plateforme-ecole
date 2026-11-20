import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listClasses } from "@/lib/data/classes";
import { getCurrentYear } from "@/lib/data/school";
import { searchStudents } from "@/lib/data/students";
import { Button, ButtonLink, Card, Input, PageHeader, Select } from "@/components/ui";

export default async function StudentsPage({ params, searchParams }: PageProps<"/[lang]/eleves">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const classId = typeof sp.classe === "string" ? sp.classe : "";
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.read");
  const year = await getCurrentYear(ctx.school.id);
  const [classes, students] = await Promise.all([
    year ? listClasses(ctx.school.id, year.id) : Promise.resolve([]),
    searchStudents(ctx.school.id, year?.id ?? null, { q, classId }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={dict.students.title}
        subtitle={t(dict.students.count, { count: students.length })}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
        action={
          can(ctx.roles, "students.write") ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/${lang}/eleves/nouveau`}>{dict.students.add}</ButtonLink>
              {can(ctx.roles, "import.write") && (
                <Link href={`/${lang}/importer`} className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                  {dict.nav.import}
                </Link>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Recherche : simple formulaire, l'adresse garde les filtres. */}
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="flex-1">
          <Input name="q" type="search" defaultValue={q} placeholder={dict.students.searchPlaceholder} aria-label={dict.common.search} />
        </div>
        <div className="sm:w-48">
          <Select name="classe" defaultValue={classId} aria-label={dict.students.filterClass}>
            <option value="">{dict.students.filterClass} : {dict.common.all}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{lang === "ar" && c.nameAr ? c.nameAr : c.name}</option>
            ))}
          </Select>
        </div>
        <Button type="submit">{dict.common.search}</Button>
      </form>

      <Card>
        {students.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.students.noResults}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {students.map((s) => {
              const cls = s.enrollments[0]?.classGroup;
              return (
                <li key={s.id}>
                  <Link href={`/${lang}/eleves/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-blue-700">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{personName(s, lang)}</span>
                      <bdi className="text-xs text-slate-500">{s.studentNumber}</bdi>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-sm">
                      {cls ? (lang === "ar" && cls.nameAr ? cls.nameAr : cls.name) : dict.students.noClass}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

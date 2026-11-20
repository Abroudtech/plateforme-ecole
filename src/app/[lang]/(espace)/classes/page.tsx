import Link from "next/link";
import { scopeOf } from "@/lib/auth/scope";
import type { Cycle } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCurrentYear } from "@/lib/data/school";
import { getLevelsAndTracks, listClasses } from "@/lib/data/classes";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { saveClass } from "./actions";
import { ClassFields } from "./class-fields";

const CYCLES: Cycle[] = ["PRIMARY", "MIDDLE", "SECONDARY"];

export default async function ClassesPage({ params }: PageProps<"/[lang]/classes">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classes.read");
  const year = await getCurrentYear(ctx.school.id);
  const scope = await scopeOf(ctx);
  const classes = (year ? await listClasses(ctx.school.id, year.id) : []).filter((c) => !scope || scope.includes(c.id));
  const { levels, tracks } = await getLevelsAndTracks(ctx.school.id, ctx.school.cycles);
  const canWrite = can(ctx.roles, "classes.write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={dict.classes.title}
        subtitle={year ? t(dict.classes.subtitle, { year: ltr(year.label) }) : dict.formErrors.noYear}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
      />

      {CYCLES.filter((c) => ctx.school.cycles.includes(c)).map((cycle) => {
        const list = classes.filter((c) => c.gradeLevel.cycle === cycle);
        return (
          <Card key={cycle} title={dict.cycles[cycle]}>
            {list.length === 0 ? (
              <p className="text-sm text-slate-500">{dict.dashboard.noClasses}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {list.map((c) => {
                  const count = c._count.enrollments;
                  const full = c.capacity != null && count >= c.capacity;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/${lang}/classes/${c.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3 hover:bg-blue-50"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold">{lang === "ar" && c.nameAr ? c.nameAr : c.name}</span>
                          <span className="block truncate text-sm text-slate-500">
                            {pickName(c.gradeLevel, lang)}
                            {c.track ? ` · ${pickName(c.track, lang)}` : ""}
                          </span>
                        </span>
                        <span className={`shrink-0 text-sm ${full ? "font-semibold text-amber-700" : "text-slate-600"}`}>
                          {c.capacity
                            ? t(dict.classes.seats, { count, capacity: c.capacity })
                            : t(dict.dashboard.studentsCount, { count })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}

      {canWrite && year && (
        <Card title={dict.classes.add}>
          <ActionForm action={saveClass.bind(null, lang, null)} labels={formLabels(dict, dict.common.add)}>
            <ClassFields dict={dict} lang={lang} levels={levels} tracks={tracks} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

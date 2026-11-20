import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getClass } from "@/lib/data/classes";
import { getClassCurriculum } from "@/lib/data/grades";
import { loadSchemeResolver } from "@/lib/grades/scheme";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, Input, PageHeader } from "@/components/ui";
import { ClassTabs } from "../../class-tabs";
import { applyDefaults, saveCurriculum } from "../../grades-actions";

export default async function CurriculumPage({ params }: PageProps<"/[lang]/classes/[id]/matieres">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classes.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();
  const [subjects, curriculum] = await Promise.all([
    db.subject.findMany({ where: { schoolId: ctx.school.id }, orderBy: { nameFr: "asc" } }),
    getClassCurriculum(ctx.school.id, cls),
  ]);
  const coefs = new Map(curriculum.map((c) => [c.subjectId, Number(c.coefficient)]));
  const schemeFor = await loadSchemeResolver(db, ctx.school.id, cls);
  const canWrite = can(ctx.roles, "classes.write");
  const levelLabel = `${pickName(cls.gradeLevel, lang)}${cls.track ? ` · ${pickName(cls.track, lang)}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name}
        subtitle={t(dict.curriculum.subtitle, { level: levelLabel })}
        back={{ href: `/${lang}/classes`, label: dict.classes.title }}
      />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="curriculum" />

      {canWrite && curriculum.length === 0 && (
        <Card>
          <ActionForm action={applyDefaults.bind(null, lang, cls.id)} labels={formLabels(dict, dict.curriculum.applyDefaults)} variant="secondary" />
        </Card>
      )}

      <Card title={dict.curriculum.title}>
        <p className="mb-4 text-sm text-slate-600">{dict.curriculum.hint}</p>
        <ActionForm action={saveCurriculum.bind(null, lang, cls.id)} labels={formLabels(dict)}>
          <ul className="divide-y divide-slate-100">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className={coefs.has(s.id) ? "font-medium" : "text-slate-500"}>{pickName(s, lang)}</span>
                  {coefs.has(s.id) && (
                    <Link href={`/${lang}/classes/${cls.id}/structure?matiere=${s.id}`} className="block text-xs text-blue-700 hover:underline">
                      {schemeFor(s.id).items.map((i) => `${dict.grades.kindsShort[i.kind]} ×${i.weight}`).join(" · ")}
                    </Link>
                  )}
                </span>
                <div className="w-24">
                  <Input
                    name={`coef_${s.id}`}
                    inputMode="decimal"
                    dir="ltr"
                    aria-label={`${dict.curriculum.coefficient} ${pickName(s, lang)}`}
                    defaultValue={coefs.get(s.id) ?? ""}
                    disabled={!canWrite}
                  />
                </div>
              </li>
            ))}
          </ul>
        </ActionForm>
      </Card>
    </div>
  );
}

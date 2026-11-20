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
import { KIND_ORDER, loadSchemeResolver } from "@/lib/grades/scheme";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { ClassTabs } from "../../class-tabs";
import { deleteScheme, saveScheme } from "../../grades-actions";

/**
 * Réglage de la structure des notes (oral, contrôle, synthèse...) d'une
 * matière, pour cette classe, pour tout le niveau, ou pour toute l'école.
 */
export default async function SchemePage({ params, searchParams }: PageProps<"/[lang]/classes/[id]/structure">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classes.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();
  const curriculum = await getClassCurriculum(ctx.school.id, cls);
  const subject = curriculum.find((c) => c.subjectId === sp.matiere) ?? curriculum[0];
  const canWrite = can(ctx.roles, "classes.write");
  const s = dict.scheme;
  const g = dict.grades;

  const resolve = await loadSchemeResolver(db, ctx.school.id, cls);
  const current = subject ? resolve(subject.subjectId) : null;
  const weights = new Map(current?.items.map((i) => [i.kind, i.weight]));
  const levelLabel = `${pickName(cls.gradeLevel, lang)}${cls.track ? ` · ${pickName(cls.track, lang)}` : ""}`;
  // Où enregistrer par défaut : là où se trouve déjà la règle, sinon "niveau".
  const defaultScope =
    current?.source === "classSubject" || current?.source === "class" ? "class" : current?.source === "school" ? "school" : "level";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={s.title} back={{ href: `/${lang}/classes/${cls.id}/matieres`, label: dict.curriculum.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="curriculum" />

      {!subject || !current ? (
        <Card><p className="text-slate-600">{g.noCurriculum}</p></Card>
      ) : (
        <>
          <Tabs
            active={subject.subjectId}
            items={curriculum.map((c) => ({ key: c.subjectId, href: `/${lang}/classes/${cls.id}/structure?matiere=${c.subjectId}`, label: pickName(c.subject, lang) }))}
          />
          <Card title={pickName(subject.subject, lang)}>
            <p className="text-sm text-slate-600">{s.intro}</p>
            <p className="mt-1 mb-4 text-sm font-medium text-blue-800">{t(s.current, { source: s.sources[current.source] })}</p>

            <ActionForm action={saveScheme.bind(null, lang, cls.id, subject.subjectId)} labels={formLabels(dict)}>
              <ul className="divide-y divide-slate-100">
                {KIND_ORDER.map((kind) => (
                  <li key={kind} className="flex items-center justify-between gap-3 py-2">
                    <label className="flex items-center gap-2 font-medium">
                      <input type="checkbox" name={`use_${kind}`} defaultChecked={weights.has(kind)} disabled={!canWrite} className="size-5" />
                      {g.kinds[kind]}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      {s.weight}
                      <input
                        name={`weight_${kind}`}
                        inputMode="decimal"
                        dir="ltr"
                        defaultValue={weights.get(kind) ?? 1}
                        disabled={!canWrite}
                        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-base"
                      />
                    </label>
                  </li>
                ))}
              </ul>

              <fieldset className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm" disabled={!canWrite}>
                <legend className="mb-1 font-medium">{s.scope}</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="scope" value="class" defaultChecked={defaultScope === "class"} className="size-4" />
                  {s.scopes.class} ({cls.name}, {pickName(subject.subject, lang)})
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="scope" value="level" defaultChecked={defaultScope === "level"} className="size-4" />
                  {s.scopes.level} ({levelLabel}, {pickName(subject.subject, lang)})
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="scope" value="school" defaultChecked={defaultScope === "school"} className="size-4" />
                  {s.scopes.school} — {s.allSubjects}
                </label>
              </fieldset>
            </ActionForm>
          </Card>

          {canWrite && current.schemeId && (
            <Card>
              <p className="mb-3 text-sm text-slate-600">{s.resetHint}</p>
              <ActionForm action={deleteScheme.bind(null, lang, current.schemeId)} labels={formLabels(dict, s.reset)} variant="danger" confirm={`${s.reset} ?`} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

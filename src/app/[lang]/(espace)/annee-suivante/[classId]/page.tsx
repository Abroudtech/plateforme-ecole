import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { getNextYear, getPromotionPlan } from "@/lib/data/rollover";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { savePromotionForm } from "../actions";

/** Classe de l'an prochain pour chaque élève d'une classe (proposée selon la décision de fin d'année). */
export default async function PromotionPage({ params }: PageProps<"/[lang]/annee-suivante/[classId]">) {
  const { lang: rawLang, classId } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "settings.write");
  const next = await getNextYear(ctx.school.id);
  if (!next) redirect(`/${lang}/annee-suivante`);
  const plan = await getPromotionPlan(ctx.school.id, classId, next.id);
  if (!plan) notFound();
  const y = dict.rollover;
  const decisions = dict.rollover.decisions;
  const fmt = (n: number | null) => (n == null ? "—" : (lang === "fr" ? n.toFixed(2).replace(".", ",") : n.toFixed(2)));
  const options = [...plan.next].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "fr", { numeric: true }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={className(plan.cls, lang)} subtitle={`${y.title} · ${next.label}`} back={{ href: `/${lang}/annee-suivante`, label: y.title }} />
      <p className="text-sm text-slate-600">{y.classIntro}</p>
      <ActionForm action={savePromotionForm.bind(null, lang, plan.cls.id)} labels={formLabels(dict, dict.common.save)}>
        <ul className="flex flex-col gap-2">
          {plan.rows.map((r) => (
            <li key={r.student.id} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200/80 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{personName(r.student, lang)}</p>
                <p className="text-sm text-slate-500">
                  {y.average} <bdi dir="ltr">{fmt(r.average)}</bdi> ·{" "}
                  <span className={r.decision === "PASS" ? "text-emerald-700" : r.decision === "FAIL" ? "text-red-700" : "text-amber-700"}>{decisions[r.decision]}</span>
                  {r.toCheck && <span className="text-amber-700"> · {y.toCheck}</span>}
                </p>
              </div>
              <select
                name={`dest_${r.student.id}`}
                defaultValue={r.proposed ?? ""}
                aria-label={personName(r.student, lang)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-56"
              >
                <option value="">{y.toDecide}</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>{className(c, lang)}</option>
                ))}
                <option value="LEAVE">{y.leave}</option>
              </select>
            </li>
          ))}
        </ul>
      </ActionForm>
    </div>
  );
}

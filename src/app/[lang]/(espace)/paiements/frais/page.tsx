import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getLevelsAndTracks } from "@/lib/data/classes";
import { listFees } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { ActionForm } from "@/components/action-form";
import { Money } from "@/components/money";
import { Card, PageHeader } from "@/components/ui";
import { deleteFee, saveFee } from "../actions";
import { FeeFields } from "./fee-fields";

export default async function FeesPage({ params }: PageProps<"/[lang]/paiements/frais">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "payments.read");
  const year = await getCurrentYear(ctx.school.id);
  const fees = year ? await listFees(ctx.school.id, year.id) : [];
  const { levels } = await getLevelsAndTracks(ctx.school.id, ctx.school.cycles);
  const canWrite = can(ctx.roles, "payments.write");
  const p = dict.payments;
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={p.fees}
        subtitle={year ? ltr(year.label) : dict.formErrors.noYear}
        back={{ href: `/${lang}/paiements`, label: p.title }}
      />
      <Card>
        {fees.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noFees}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fees.map((f) => (
              <li key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{lang === "ar" && f.nameAr ? f.nameAr : f.name}</span>
                    <span className="block text-sm text-slate-500">
                      {p.dueDate} : {fmt.format(f.dueDate)} · {f.gradeLevel ? pickName(f.gradeLevel, lang) : p.allLevels}
                      {f.isOptional && ` · ${p.optionalShort} (${t(p.subscribers, { count: f._count.students })})`}
                    </span>
                  </span>
                  <Money value={f.amountMillimes} lang={lang} className="font-semibold" />
                </div>
                {canWrite && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-blue-700">{p.editFee}</summary>
                    <div className="mt-2 flex flex-col gap-3">
                      <ActionForm action={saveFee.bind(null, lang, f.id)} labels={formLabels(dict, dict.common.save)}>
                        <FeeFields dict={dict} lang={lang} levels={levels} value={f} />
                      </ActionForm>
                      <ActionForm
                        action={deleteFee.bind(null, lang, f.id)}
                        labels={formLabels(dict, p.deleteFee)}
                        variant="danger"
                        confirm={`${p.deleteFee} ?`}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canWrite && year && (
        <Card title={p.addFee}>
          <ActionForm action={saveFee.bind(null, lang, null)} labels={formLabels(dict, dict.common.add)} resetOnSuccess>
            <FeeFields dict={dict} lang={lang} levels={levels} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { parseISODate, todayISO } from "@/lib/dates";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { Card, Field, Input, PageHeader } from "@/components/ui";

/** Journal des encaissements sur une période (par défaut : aujourd'hui). */
export default async function PaymentsJournalPage({ params, searchParams }: PageProps<"/[lang]/paiements/encaissements">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "payments.read");
  const p = dict.payments;
  const today = todayISO();
  const fromStr = typeof sp.du === "string" && parseISODate(sp.du) ? sp.du : today;
  const toStr = typeof sp.au === "string" && parseISODate(sp.au) ? sp.au : fromStr;
  const payments = await db.payment.findMany({
    where: { schoolId: ctx.school.id, paidAt: { gte: parseISODate(fromStr)!, lte: parseISODate(toStr)! } },
    include: { student: true },
    orderBy: [{ paidAt: "asc" }, { receiptNumber: "asc" }],
  });
  const valid = payments.filter((x) => !x.cancelledAt);
  const total = valid.reduce((s, x) => s + x.amountMillimes, 0);
  const byMethod = new Map<string, number>();
  for (const x of valid) byMethod.set(x.method, (byMethod.get(x.method) ?? 0) + x.amountMillimes);
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={p.journal}
          back={{ href: `/${lang}/paiements`, label: p.title }}
          action={<PrintButton label={dict.reportCards.print} />}
        />
        <Card>
          <form className="flex flex-wrap items-end gap-3">
            <Field label={p.from}>
              <Input name="du" type="date" defaultValue={fromStr} />
            </Field>
            <Field label={p.to}>
              <Input name="au" type="date" defaultValue={toStr} />
            </Field>
            <button className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white">{p.show}</button>
            <Link href={`/${lang}/paiements/encaissements`} className="py-2.5 text-sm text-blue-700">{p.today}</Link>
          </form>
        </Card>
      </div>
      <h1 className="hidden text-xl font-bold print:block">{p.journal} · {fromStr} → {toStr}</h1>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold">{p.total} : <Money value={total} lang={lang} /></p>
          <p className="text-sm text-slate-600">{t(p.count, { count: valid.length })}</p>
        </div>
        {byMethod.size > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            {[...byMethod.entries()].map(([m, v], i) => (
              <span key={m}>{i > 0 && " · "}{p.methods[m as keyof typeof p.methods]} : <Money value={v} lang={lang} /></span>
            ))}
          </p>
        )}
      </Card>

      <Card>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noPayments}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {payments.map((x) => (
              <li key={x.id} className={`flex items-center justify-between gap-3 py-2 ${x.cancelledAt ? "opacity-50" : ""}`}>
                <Link href={`/${lang}/paiements/recus/${x.id}`} className="min-w-0 hover:underline">
                  <span className="font-semibold">{personName(x.student, lang)}</span>
                  <span className="block text-sm text-slate-500">
                    {fmt.format(x.paidAt)} · {t(p.receiptNo, { n: x.receiptNumber })} · {p.methods[x.method]}
                    {x.cancelledAt && ` · ${p.cancelled}`}
                  </span>
                </Link>
                <Money value={x.amountMillimes} lang={lang} className={`shrink-0 font-semibold ${x.cancelledAt ? "line-through" : ""}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

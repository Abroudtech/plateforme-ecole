import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { getStudentAccount } from "@/lib/data/payments";
import { isGuardianOf } from "@/lib/data/grades";
import { getCurrentYear } from "@/lib/data/school";
import { amountInputValue, type ChargeStatus } from "@/lib/payments";
import { ActionForm } from "@/components/action-form";
import { Money } from "@/components/money";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import {
  addStudentFee,
  cancelPayment,
  recordPayment,
  removeStudentFee,
  sendReminder,
  setStudentFeeAmount,
} from "../../../paiements/actions";

const STATUS_STYLE: Record<ChargeStatus, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  upcoming: "bg-slate-100 text-slate-700",
};

function dateLabel(d: Date, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Compte d'un élève : frais, paiements, relances. Les parents le voient en lecture seule. */
export default async function StudentPaymentsPage({ params }: PageProps<"/[lang]/eleves/[id]/paiements">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const schoolId = ctx.school.id;
  const isStaff = can(ctx.roles, "payments.read");
  if (!isStaff && !(can(ctx.roles, "children.read") && (await isGuardianOf(schoolId, ctx.user.id, id)))) {
    redirect(`/${lang}/acces-refuse`);
  }
  const canWrite = can(ctx.roles, "payments.write");
  const student = await db.student.findFirst({ where: { id, schoolId } });
  const year = await getCurrentYear(schoolId);
  if (!student || !year) notFound();
  const today = todayISO();
  const data = await getStudentAccount(schoolId, id, year.id, today);
  if (!data) notFound();
  const { account, lines, payments, reminders, optionalAvailable } = data;
  const p = dict.payments;
  const cls = data.enrollment.classGroup;
  const feeName = (f: { name: string; nameAr: string | null }) => (lang === "ar" && f.nameAr ? f.nameAr : f.name);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={personName(student, lang)}
        subtitle={<>{isStaff ? p.account : p.parentIntro} · {lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} · {ltr(year.label)}</>}
        back={isStaff ? { href: `/${lang}/eleves/${student.id}`, label: dict.students.title } : { href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: p.totalDue, value: account.totalDue, cls: "" },
          { label: p.collected, value: account.totalPaid, cls: "text-green-700" },
          { label: p.balance, value: account.balance, cls: "" },
          { label: p.overdue, value: account.overdue, cls: account.overdue > 0 ? "text-red-700" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls}`}><Money value={s.value} lang={lang} /></p>
          </div>
        ))}
      </div>
      {account.credit > 0 && <p className="text-sm text-green-700">{t(p.credit, { amount: "" })}<Money value={account.credit} lang={lang} /></p>}

      {canWrite && account.overdue > 0 && (
        <Card title={p.remind}>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={sendReminder.bind(null, lang, student.id, "WHATSAPP")} labels={formLabels(dict, p.remindWhatsapp)} />
            <ActionForm action={sendReminder.bind(null, lang, student.id, "LETTER")} labels={formLabels(dict, p.remindLetter)} variant="secondary" />
            <ActionForm action={sendReminder.bind(null, lang, student.id, "CALL")} labels={formLabels(dict, p.remindCall)} variant="secondary" />
          </div>
          {reminders.length > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              {p.reminders} : {reminders.map((r) => `${p.channels[r.channel]} (${dateLabel(r.createdAt, lang)})`).join(" · ")}
            </p>
          )}
        </Card>
      )}

      <Card title={p.charges}>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noFees}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{feeName(l.fee)}</span>
                    <span className="block text-sm text-slate-500">
                      {p.dueDate} : {dateLabel(l.fee.dueDate, lang)}
                      {l.custom?.note ? ` · ${l.custom.note}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Money value={l.amount} lang={lang} className="font-semibold" />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status]}`}>{p.statuses[l.status]}</span>
                  </span>
                </div>
                {l.status === "partial" || (l.status === "overdue" && l.paid > 0) ? (
                  <p className="text-xs text-slate-600">
                    <Money value={l.paid} lang={lang} /> / <Money value={l.amount} lang={lang} />
                  </p>
                ) : null}
                {canWrite && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-blue-700">{p.customAmount}</summary>
                    <div className="mt-2 flex flex-col gap-2">
                      <ActionForm action={setStudentFeeAmount.bind(null, lang, student.id, l.fee.id)} labels={formLabels(dict, dict.common.save)}>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label={p.customAmount} hint={p.customHint}>
                            <Input name="amount" inputMode="decimal" dir="ltr" defaultValue={l.custom?.amountMillimes != null ? amountInputValue(l.custom.amountMillimes) : ""} />
                          </Field>
                          <Field label={p.note} hint={dict.common.optional}>
                            <Input name="note" defaultValue={l.custom?.note ?? ""} />
                          </Field>
                        </div>
                        <p className="text-xs text-slate-500">{t(p.normalAmount, { amount: "" })}<Money value={l.fee.amountMillimes} lang={lang} /></p>
                      </ActionForm>
                      {l.fee.isOptional && (
                        <ActionForm
                          action={removeStudentFee.bind(null, lang, student.id, l.fee.id)}
                          labels={formLabels(dict, p.unsubscribe)}
                          variant="danger"
                          confirm={`${p.unsubscribe} ?`}
                        />
                      )}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {canWrite && optionalAvailable.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <ActionForm action={addStudentFee.bind(null, lang, student.id)} labels={formLabels(dict, dict.common.add)}>
              <Field label={p.addService}>
                <Select name="feeId" required defaultValue="">
                  <option value="" disabled>—</option>
                  {optionalAvailable.map((f) => (
                    <option key={f.id} value={f.id}>{feeName(f)}</option>
                  ))}
                </Select>
              </Field>
            </ActionForm>
          </div>
        )}
      </Card>

      {canWrite && (
        <Card title={p.record}>
          <ActionForm action={recordPayment.bind(null, lang, student.id)} labels={formLabels(dict, p.record)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={p.amount}>
                <Input
                  name="amount"
                  required
                  inputMode="decimal"
                  dir="ltr"
                  defaultValue={account.overdue > 0 ? amountInputValue(account.overdue) : ""}
                />
              </Field>
              <Field label={p.paidAt}>
                <Input name="paidAt" type="date" required defaultValue={today} max={today} />
              </Field>
              <Field label={p.method}>
                <Select name="method" defaultValue="CASH">
                  {(["CASH", "CHECK", "TRANSFER", "CARD", "OTHER"] as const).map((m) => (
                    <option key={m} value={m}>{p.methods[m]}</option>
                  ))}
                </Select>
              </Field>
              <Field label={p.reference} hint={dict.common.optional}>
                <Input name="reference" dir="ltr" />
              </Field>
            </div>
            <Field label={p.note} hint={dict.common.optional}>
              <Input name="note" />
            </Field>
          </ActionForm>
        </Card>
      )}

      <Card title={p.history}>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noPayments}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((pay) => (
              <li key={pay.id} className={`rounded-lg bg-slate-50 px-3 py-2 ${pay.cancelledAt ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{dateLabel(pay.paidAt, lang)}</span>
                    <span className="text-sm text-slate-500"> · {p.methods[pay.method]}{pay.reference ? ` ${ltr(pay.reference)}` : ""}</span>
                  </span>
                  <Money value={pay.amountMillimes} lang={lang} className={`font-semibold ${pay.cancelledAt ? "line-through" : ""}`} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/${lang}/paiements/recus/${pay.id}`} className="text-blue-700 hover:underline">
                    {t(p.receiptNo, { n: pay.receiptNumber })}
                  </Link>
                  {pay.cancelledAt && <span className="text-red-700">{t(p.cancelledOn, { reason: pay.cancelReason ?? "" })}</span>}
                </div>
                {canWrite && !pay.cancelledAt && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-red-700">{p.cancel}</summary>
                    <ActionForm action={cancelPayment.bind(null, lang, pay.id)} labels={formLabels(dict, p.cancel)} variant="danger" className="mt-2">
                      <Field label={p.cancelReason}>
                        <Input name="reason" required />
                      </Field>
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

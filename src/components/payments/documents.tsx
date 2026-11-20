import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { formatMoney } from "@/lib/payments";

type School = { nameFr: string; nameAr: string; city: string | null; address: string | null; phone: string | null };
type Person = { firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null };
type Class = { name: string; nameAr: string | null };

const frName = (p: Person) => `${p.firstName} ${p.lastName}`;
const arName = (p: Person) => (p.firstNameAr || p.lastNameAr ? `${p.firstNameAr ?? p.firstName} ${p.lastNameAr ?? p.lastName}` : frName(p));

function frDate(d: Date) {
  return new Intl.DateTimeFormat("fr-TN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Libellé bilingue : français à gauche, arabe à droite. */
function Row({ fr, ar, children }: { fr: string; ar: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 border-b border-slate-200 py-2 last:border-0">
      <span lang="fr" className="text-slate-600">{fr}</span>
      <span className="text-center font-semibold">{children}</span>
      <span lang="ar" dir="rtl" className="text-right text-slate-600">{ar}</span>
    </div>
  );
}

function Header({ school }: { school: School }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3" dir="ltr">
      <div lang="fr">
        <p className="text-base font-bold">{school.nameFr}</p>
        {school.address && <p className="text-slate-600">{school.address}</p>}
        {school.city && <p className="text-slate-600">{school.city}</p>}
        {school.phone && <p className="text-slate-600">{school.phone}</p>}
      </div>
      <div lang="ar" dir="rtl" className="text-right">
        <p className="text-base font-bold">{school.nameAr}</p>
      </div>
    </header>
  );
}

const docClass = "mx-auto max-w-2xl rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 print:max-w-none print:rounded-none print:p-0 print:ring-0";

/** Reçu de paiement bilingue, prêt à imprimer. */
export function Receipt({
  school,
  student,
  cls,
  payment,
  balance,
  receivedBy,
  fr,
  ar,
}: {
  school: School;
  student: Person;
  cls: Class | null;
  payment: { receiptNumber: number; amountMillimes: number; method: keyof Dictionary["payments"]["methods"]; reference: string | null; paidAt: Date; note: string | null; cancelledAt: Date | null; cancelReason: string | null };
  balance: number | null;
  receivedBy: string | null;
  fr: Dictionary;
  ar: Dictionary;
}) {
  const F = fr.payments;
  const A = ar.payments;
  return (
    <article className={docClass} dir="ltr">
      <Header school={school} />
      <div className="my-4 text-center">
        <h1 className="text-xl font-bold">
          {F.receiptTitle} <span className="mx-1 text-slate-400">·</span> <span lang="ar">{A.receiptTitle}</span>
        </h1>
        <p className="text-lg font-semibold tabular-nums">N° {String(payment.receiptNumber).padStart(6, "0")}</p>
        {payment.cancelledAt && (
          <p className="mt-2 rounded-lg bg-red-50 py-1 font-bold text-red-700">
            {F.cancelled} · <span lang="ar">{A.cancelled}</span>
            {payment.cancelReason ? ` — ${payment.cancelReason}` : ""}
          </p>
        )}
      </div>
      <div className="rounded-lg bg-slate-50 px-3">
        <Row fr={F.date} ar={A.date}><bdi dir="ltr">{frDate(payment.paidAt)}</bdi></Row>
        <Row fr={F.student} ar={A.student}>
          <span className="flex flex-col"><span>{frName(student)}</span><span lang="ar" dir="rtl">{arName(student)}</span></span>
        </Row>
        {cls && <Row fr={F.class} ar={A.class}>{cls.name}</Row>}
        <Row fr={F.amount} ar={A.amount}><span className="text-lg"><bdi dir="ltr">{formatMoney(payment.amountMillimes, "fr")}</bdi></span></Row>
        <Row fr={F.method} ar={A.method}>
          {F.methods[payment.method]} / <span lang="ar">{A.methods[payment.method]}</span>
          {payment.reference && <span className="block font-normal"><bdi dir="ltr">{payment.reference}</bdi></span>}
        </Row>
        {payment.note && <Row fr={F.note} ar={A.note}>{payment.note}</Row>}
        {balance != null && !payment.cancelledAt && (
          <Row fr={F.balanceAfter} ar={A.balanceAfter}><bdi dir="ltr">{formatMoney(balance, "fr")}</bdi></Row>
        )}
        {receivedBy && <Row fr={F.receivedBy} ar={A.receivedBy}>{receivedBy}</Row>}
      </div>
      <div className="mt-8 flex justify-between text-slate-600">
        <span>{F.signature}</span>
        <span lang="ar">{A.signature}</span>
      </div>
      <div className="h-20" />
    </article>
  );
}

/** Lettre de relance bilingue (arabe et français sur la même page). */
export function ReminderLetter({
  school,
  student,
  cls,
  overdueLines,
  overdue,
  date,
  fr,
  ar,
}: {
  school: School;
  student: Person;
  cls: Class;
  overdueLines: { id: string; name: string; nameAr: string | null; dueDate: Date; remaining: number }[];
  overdue: number;
  date: Date;
  fr: Dictionary;
  ar: Dictionary;
}) {
  const F = fr.payments;
  const A = ar.payments;
  const vars = (lg: "fr" | "ar") => ({
    amount: formatMoney(overdue, lg),
    student: lg === "ar" ? arName(student) : frName(student),
    class: lg === "ar" && cls.nameAr ? cls.nameAr : cls.name,
  });
  return (
    <article className={docClass} dir="ltr">
      <Header school={school} />
      <p className="mt-3 text-right tabular-nums">{frDate(date)}</p>
      <h1 className="my-4 text-center text-xl font-bold">
        {F.letterTitle} <span className="mx-1 text-slate-400">·</span> <span lang="ar">{A.letterTitle}</span>
      </h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
        <section lang="fr" className="flex flex-col gap-3 leading-relaxed">
          <p>{F.letterGreeting}</p>
          <p>{t(F.letterBody, vars("fr"))}</p>
          <p>{F.letterClosing}</p>
          <p className="font-semibold">{F.letterSign}</p>
        </section>
        <section lang="ar" dir="rtl" className="flex flex-col gap-3 leading-relaxed">
          <p>{A.letterGreeting}</p>
          <p>{t(A.letterBody, vars("ar"))}</p>
          <p>{A.letterClosing}</p>
          <p className="font-semibold">{A.letterSign}</p>
        </section>
      </div>
      <table className="mt-6 w-full border-collapse text-sm">
        <caption className="mb-1 text-start font-semibold">{F.letterDetails} · <span lang="ar">{A.letterDetails}</span></caption>
        <tbody>
          {overdueLines.map((l) => (
            <tr key={l.id} className="border-b border-slate-200">
              <td className="py-1.5">{l.name}</td>
              <td className="py-1.5 tabular-nums">{frDate(l.dueDate)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(l.remaining, "fr")}</td>
              <td className="py-1.5 text-right" lang="ar" dir="rtl">{l.nameAr ?? ""}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-1.5">{F.total}</td>
            <td />
            <td className="py-1.5 text-right tabular-nums">{formatMoney(overdue, "fr")}</td>
            <td className="py-1.5 text-right" lang="ar" dir="rtl">{A.total}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { personName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { isGuardianOf } from "@/lib/data/grades";
import { getStudentAccount } from "@/lib/data/payments";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { Receipt } from "@/components/payments/documents";

export default async function ReceiptPage({ params }: PageProps<"/[lang]/paiements/recus/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const [dict, fr, ar] = await Promise.all([getDictionary(lang), getDictionary("fr"), getDictionary("ar")]);
  const ctx = await requireContext(lang);
  const payment = await db.payment.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: { student: true, createdBy: true },
  });
  if (!payment) notFound();
  const isStaff = can(ctx.roles, "payments.read");
  if (!isStaff && !(can(ctx.roles, "children.read") && (await isGuardianOf(ctx.school.id, ctx.user.id, payment.studentId)))) {
    redirect(`/${lang}/acces-refuse`);
  }
  const account = await getStudentAccount(ctx.school.id, payment.studentId, payment.academicYearId, todayISO());

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={dict.payments.receiptTitle}
          subtitle={personName(payment.student, lang)}
          back={{ href: `/${lang}/eleves/${payment.studentId}/paiements`, label: dict.payments.account }}
          action={<PrintButton label={dict.reportCards.print} />}
        />
      </div>
      <Receipt
        school={ctx.school}
        student={payment.student}
        cls={account?.enrollment.classGroup ?? null}
        payment={payment}
        balance={account?.account.balance ?? null}
        receivedBy={payment.createdBy ? `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : null}
        fr={fr}
        ar={ar}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { getStudentAccount } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { ReminderLetter } from "@/components/payments/documents";

export default async function ReminderLetterPage({ params }: PageProps<"/[lang]/eleves/[id]/paiements/relance">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const [dict, fr, ar] = await Promise.all([getDictionary(lang), getDictionary("fr"), getDictionary("ar")]);
  const ctx = await requirePermission(lang, "payments.read");
  const student = await db.student.findFirst({ where: { id, schoolId: ctx.school.id } });
  const year = await getCurrentYear(ctx.school.id);
  const data = student && year ? await getStudentAccount(ctx.school.id, id, year.id, todayISO()) : null;
  if (!student || !data) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={dict.payments.letterTitle}
          subtitle={personName(student, lang)}
          back={{ href: `/${lang}/eleves/${id}/paiements`, label: dict.payments.account }}
          action={<PrintButton label={dict.reportCards.print} />}
        />
      </div>
      <ReminderLetter
        school={ctx.school}
        student={student}
        cls={data.enrollment.classGroup}
        overdueLines={data.lines
          .filter((l) => l.status === "overdue")
          .map((l) => ({ id: l.id, name: l.fee.name, nameAr: l.fee.nameAr, dueDate: l.fee.dueDate, remaining: l.remaining }))}
        overdue={data.account.overdue}
        date={new Date(`${todayISO()}T00:00:00Z`)}
        fr={fr}
        ar={ar}
      />
    </div>
  );
}

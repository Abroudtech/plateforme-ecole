import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { smsConfigFromEnv } from "@/lib/sms";
import { Card, PageHeader } from "@/components/ui";
import { BulkAccessForm } from "./bulk-form";

/** Accès des parents de toute une classe en une fois, avec fiches imprimables. */
export default async function ClassParentAccessPage({ params }: PageProps<"/[lang]/classes/[id]/acces-parents">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.write");
  const cls = await db.classGroup.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        select: { student: { select: { guardians: { select: { guardian: { select: { id: true, userId: true, phone: true, email: true } } } } } } },
      },
    },
  });
  if (!cls) notFound();
  const guardians = new Map(cls.enrollments.flatMap((e) => e.student.guardians.map((g) => [g.guardian.id, g.guardian] as const)));
  const withAccount = [...guardians.values()].filter((g) => g.userId).length;
  const b = dict.bulkAccess;
  const host = (await headers()).get("host") ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader title={b.title} subtitle={className(cls, lang)} back={{ href: `/${lang}/classes/${cls.id}`, label: dict.classes.students }} />
      </div>
      <Card className="print:hidden">
        <p className="text-sm text-slate-600">{b.explain}</p>
        <p className="mt-2 text-sm font-medium">{t(b.stats, { students: cls.enrollments.length, done: withAccount, total: guardians.size })}</p>
      </Card>
      <BulkAccessForm
        lang={lang}
        classId={cls.id}
        smsAvailable={!!smsConfigFromEnv()}
        labels={{
          submit: b.submit,
          pending: dict.common.saving,
          sms: b.sms,
          smsUnavailable: b.smsUnavailable,
          print: b.print,
          intro: b.resultIntro,
          student: b.student,
          guardian: b.guardian,
          login: dict.guardians.login,
          password: dict.guardians.tempPassword,
          site: b.site,
          siteUrl: host,
          school: pickName(ctx.school, lang),
          statuses: b.statuses,
          smsSent: b.smsSent,
          notFound: dict.formErrors.notFound,
        }}
      />
    </div>
  );
}

import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scopeOf } from "@/lib/auth/scope";
import { FOLLOWUP, studentsToFollow } from "@/lib/data/followup";
import { FollowupList } from "@/components/followup";
import { Card, PageHeader } from "@/components/ui";

/** Élèves à suivre : moyenne faible ou en baisse, absences répétées, impayés anciens. */
export default async function FollowupPage({ params }: PageProps<"/[lang]/eleves-a-suivre">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.read");
  const money = can(ctx.roles, "payments.read");
  const rows = await studentsToFollow(ctx.school.id, await scopeOf(ctx), { money });
  const f = dict.followup;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={f.title} subtitle={f.intro} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <Card>
        {rows.length === 0 ? <p className="text-sm text-slate-500">{f.none}</p> : <FollowupList rows={rows} lang={lang} dict={dict} />}
      </Card>
      <p className="text-xs text-slate-500">
        {t(money ? f.rulesMoney : f.rules, { average: FOLLOWUP.lowAverage, drop: FOLLOWUP.drop, absences: FOLLOWUP.absences, days: FOLLOWUP.unpaidDays })}
      </p>
    </div>
  );
}

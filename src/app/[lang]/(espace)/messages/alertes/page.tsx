import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { smsConfigFromEnv } from "@/lib/sms";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { retryAlerts, saveAlertSettings } from "../actions";

const STATUS_STYLE = {
  PENDING: "bg-slate-100 text-slate-700",
  SENT: "bg-green-100 text-green-800",
  SIMULATED: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
} as const;

export default async function AlertsPage({ params }: PageProps<"/[lang]/messages/alertes">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "alerts.manage");
  const m = dict.messages;
  const notifications = await db.notification.findMany({
    where: { schoolId: ctx.school.id },
    include: { guardian: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const failed = notifications.filter((n) => n.status === "FAILED").length;
  const configured = smsConfigFromEnv() != null;
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={m.alerts} subtitle={m.alertsIntro} back={{ href: `/${lang}/messages`, label: m.title }} />
      {!configured && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{m.simulatedHint}</p>}
      <Card title={m.alertSettings}>
        <ActionForm action={saveAlertSettings.bind(null, lang)} labels={formLabels(dict, dict.common.save)}>
          {(["alertAbsence", "alertReportCard", "alertMessage"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={k} defaultChecked={ctx.school[k]} className="size-5" />
              {m[k]}
            </label>
          ))}
          <label className="flex items-start gap-2 border-t border-slate-100 pt-3 text-sm">
            <input type="checkbox" name="smsOnlyWithoutApp" defaultChecked={ctx.school.smsOnlyWithoutApp} className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="block font-medium">{dict.push.smsOnlyWithoutApp}</span>
              <span className="text-slate-500">{dict.push.smsOnlyWithoutAppHint}</span>
            </span>
          </label>
        </ActionForm>
      </Card>
      <Card title={m.alerts}>
        {failed > 0 && (
          <ActionForm action={retryAlerts.bind(null, lang)} labels={formLabels(dict, m.retry)} variant="secondary" className="mb-3" />
        )}
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">{m.noAlerts}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {m.kinds[n.kind]} · {n.guardian ? personName(n.guardian, lang) : ""} <bdi dir="ltr" className="font-normal text-slate-500">{n.toPhone}</bdi>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {fmt.format(n.createdAt)}
                    <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[n.status]}`}>{m.statuses[n.status]}</span>
                  </span>
                </div>
                <p className="text-slate-600" dir="auto">{n.body}</p>
                {n.error && <p className="text-xs text-red-700">{n.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

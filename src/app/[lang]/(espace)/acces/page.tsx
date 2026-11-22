import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { pendingResetRequests } from "@/lib/data/school";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { dismissReset, giveTempPassword } from "./actions";

/** Demandes « mot de passe oublié » des comptes de l'école. */
export default async function AccessRequestsPage({ params }: PageProps<"/[lang]/acces">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.write");
  const r = dict.reset;
  const requests = await pendingResetRequests(ctx.school.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={r.requests} subtitle={r.requestsIntro} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      {requests.length === 0 ? (
        <Card><p className="text-sm text-slate-500">{r.none}</p></Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((req) => (
            <li key={req.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
              <p className="font-semibold">{personName(req.user, lang)}</p>
              <p className="text-sm text-slate-500">
                {req.user.memberships.map((m) => dict.roles[m.role]).join(" · ")} ·{" "}
                <bdi dir="ltr">{req.user.phone ?? req.user.email ?? req.user.username}</bdi> ·{" "}
                {new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }).format(req.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <ActionForm
                  action={giveTempPassword.bind(null, lang, req.id)}
                  labels={{ ...formLabels(dict, r.give), credentials: { intro: r.given, login: dict.guardians.login, password: dict.guardians.tempPassword } }}
                />
                <ActionForm action={dismissReset.bind(null, lang, req.id)} labels={formLabels(dict, r.dismiss)} variant="secondary" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

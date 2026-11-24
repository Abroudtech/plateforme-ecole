import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { changePassword, setPreferredLocale } from "./actions";
import { PushToggle } from "@/components/push-toggle";
import { vapidKeys } from "@/lib/push";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/session";

export default async function AccountPage({ params }: PageProps<"/[lang]/mon-compte">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const a = dict.account;
  const [user, keys] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: ctx.user.id } }), vapidKeys()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={a.title} subtitle={personName(user, lang)} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <Card>
        <p className="text-sm text-slate-500">{a.identity}</p>
        <p className="font-semibold"><bdi dir="ltr">{user.email ?? user.phone?.replace(/^\+216/, "") ?? user.username}</bdi></p>
      </Card>
      <PushToggle publicKey={keys.publicKey} labels={dict.push} />
      <Card title={a.password}>
        <ActionForm action={changePassword.bind(null, lang)} labels={formLabels(dict, a.password)} resetOnSuccess>
          <Field label={a.current}>
            <Input name="current" type="password" required autoComplete="current-password" dir="ltr" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={a.new} hint={a.hint}>
              <Input name="next" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
            </Field>
            <Field label={a.confirm}>
              <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
            </Field>
          </div>
        </ActionForm>
      </Card>
      <Card title={a.language}>
        <ActionForm action={setPreferredLocale.bind(null, lang)} labels={formLabels(dict)}>
          <Select name="locale" defaultValue={user.preferredLocale}>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </Select>
        </ActionForm>
      </Card>
      {/* Se déconnecter aussi depuis « Mon compte », où on le cherche naturellement sur téléphone. */}
      <form action={logout.bind(null, lang)}>
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-3.5 text-sm font-semibold text-red-700 shadow-card ring-1 ring-slate-200 hover:bg-red-50">
          <LogOut size={18} className="rtl:rotate-180" aria-hidden /> {dict.nav.logout}
        </button>
      </form>
    </div>
  );
}

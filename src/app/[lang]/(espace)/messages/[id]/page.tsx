import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getConversation, markRead } from "@/lib/data/messages";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { replyMessage } from "../actions";

export default async function ConversationPage({ params }: PageProps<"/[lang]/messages/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "messages.send");
  const m = dict.messages;
  const conv = await getConversation(ctx.school.id, id);
  if (!conv) notFound();
  const schoolSide = can(ctx.roles, "messages.school");
  if (!schoolSide && conv.guardian.userId !== ctx.user.id) redirect(`/${lang}/acces-refuse`);
  await markRead(conv.id, ctx.user.id);
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={conv.subject}
        subtitle={
          <>
            {schoolSide ? t(m.withParent, { parent: personName(conv.guardian, lang) }) : m.school}
            {conv.student ? ` · ${t(m.about, { student: personName(conv.student, lang) })}` : ""}
          </>
        }
        back={{ href: `/${lang}/messages`, label: m.title }}
      />
      <ol className="flex flex-col gap-3">
        {conv.messages.map((msg) => {
          const mine = msg.fromSchool === schoolSide;
          const who = msg.fromSchool
            ? schoolSide && msg.author ? personName(msg.author, lang) : m.school
            : personName(conv.guardian, lang);
          return (
            <li key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? "bg-blue-700 text-white" : "bg-white ring-1 ring-slate-200"}`}>
                <p className={`text-xs ${mine ? "text-blue-100" : "text-slate-500"}`}>
                  {mine ? m.you : who} · {fmt.format(msg.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words" dir="auto">{msg.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Card>
        <ActionForm action={replyMessage.bind(null, lang, conv.id)} labels={formLabels(dict, m.send)} resetOnSuccess>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {m.reply}
            <textarea name="body" required rows={3} maxLength={4000} dir="auto" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}

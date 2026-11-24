import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { canSeeConsent, consentClosed, consentStudents } from "@/lib/data/consents";
import { todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { formatDay } from "@/components/homework-entry";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader } from "@/components/ui";
import { deleteConsent, remindConsent } from "../actions";

/** Suivi d'une demande : qui a dit oui, non, ou n'a pas encore répondu ; liste imprimable. */
export default async function ConsentPage({ params }: PageProps<"/[lang]/autorisations/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "consents.write");
  const c = dict.consents;
  const r = await db.consentRequest.findFirst({ where: { id, schoolId: ctx.school.id }, include: { replies: true } });
  if (!r || !(await canSeeConsent(ctx, r))) notFound();
  const students = await consentStudents(ctx.school.id, r);
  const byStudent = new Map(r.replies.map((x) => [x.studentId, x]));
  const yes = students.filter((s) => byStudent.get(s.studentId)?.accepted === true).length;
  const no = students.filter((s) => byStudent.get(s.studentId)?.accepted === false).length;
  const waiting = students.length - yes - no;
  const closed = consentClosed(r.deadline, todayISO());
  const mine = ctx.roles.includes("ADMIN") || r.createdById === ctx.user.id;

  // Regroupement par classe.
  const classes = new Map<string, typeof students>();
  for (const s of students) classes.set(s.classGroupId, [...(classes.get(s.classGroupId) ?? []), s]);

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={r.title}
          subtitle={r.deadline ? (closed ? c.closed : t(c.before, { date: formatDay(r.deadline, lang) })) : undefined}
          back={{ href: `/${lang}/autorisations`, label: c.title }}
          action={<PrintButton label={c.print} />}
        />
      </div>
      <h1 className="hidden text-xl font-bold print:block" dir="auto">{ctx.school.nameFr} · {r.title}</h1>
      {r.details && <p className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-slate-700 shadow-card ring-1 ring-slate-200/80 print:p-0 print:shadow-none print:ring-0" dir="auto">{r.details}</p>}

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: c.yesShort, value: yes, cls: "bg-emerald-50 text-emerald-800" },
          { label: c.noShort, value: no, cls: "bg-red-50 text-red-800" },
          { label: c.waiting, value: waiting, cls: "bg-slate-100 text-slate-700" },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl p-3 text-center ${k.cls}`}>
            <p className="text-3xl font-bold tabular-nums">{k.value}</p>
            <p className="text-sm font-semibold">{k.label}</p>
          </div>
        ))}
      </section>

      {waiting > 0 && !closed && (
        <div className="print:hidden">
          <ActionForm action={remindConsent.bind(null, lang, r.id)} labels={{ ...formLabels(dict, c.remind), saved: c.reminded }} variant="secondary" />
        </div>
      )}

      {[...classes.entries()].map(([classId, list]) => (
        <Card key={classId} title={className(list[0].classGroup, lang)}>
          <ol className="divide-y divide-slate-100">
            {list.map((s) => {
              const reply = byStudent.get(s.studentId);
              return (
                <li key={s.studentId} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium">{personName(s.student, lang)}</span>
                  {reply ? (
                    reply.accepted ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CircleCheck size={16} aria-hidden /> {c.yesShort}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-700"><CircleX size={16} aria-hidden /> {c.noShort}</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-slate-500"><Clock size={15} aria-hidden /> {c.waiting}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      ))}

      {mine && (
        <div className="print:hidden">
          <ActionForm action={deleteConsent.bind(null, lang, r.id)} labels={formLabels(dict, c.delete)} variant="danger" confirm={c.confirmDelete} />
        </div>
      )}
    </div>
  );
}

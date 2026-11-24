import Link from "next/link";
import { ChevronRight, FileSignature } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { managedClasses } from "@/lib/data/class-space";
import { consentClosed, consentsForParent, consentStudents, listConsentsForStaff } from "@/lib/data/consents";
import { todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { ConsentCard } from "@/components/consent-card";
import { formatDay } from "@/components/homework-entry";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { redirect } from "next/navigation";
import { createConsent } from "./actions";

/**
 * Autorisations (coupons-réponses) : l'équipe envoie une demande, chaque parent
 * répond oui ou non pour son enfant, et l'équipe voit qui a répondu.
 */
export default async function ConsentsPage({ params }: PageProps<"/[lang]/autorisations">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const staff = can(ctx.roles, "consents.write");
  const parent = can(ctx.roles, "children.read");
  if (!staff && !parent) redirect(`/${lang}/acces-refuse`);
  const c = dict.consents;
  const today = todayISO();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={c.title} subtitle={staff ? c.subtitleStaff : c.subtitleParent} />
      {parent && <ParentSection />}
      {staff && <StaffSection />}
    </div>
  );

  async function ParentSection() {
    const rows = await consentsForParent(ctx.school.id, ctx.user.id);
    const multiChild = (rows[0]?.childCount ?? 0) > 1;
    const open = rows.filter((r) => !r.reply && !consentClosed(r.request.deadline, today));
    const rest = rows.filter((r) => !open.includes(r));
    if (rows.length === 0) return <p className="rounded-2xl bg-white p-5 text-slate-500 shadow-card ring-1 ring-slate-200/80">{c.noChildren}</p>;
    return (
      <>
        {open.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-blue-900">{c.toAnswer} ({open.length})</h2>
            {open.map((r) => (
              <ConsentCard key={`${r.request.id}-${r.student.id}`} row={r} lang={lang} dict={dict} closed={false} multiChild={multiChild} />
            ))}
          </section>
        )}
        {rest.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-blue-900">{c.answered}</h2>
            {rest.map((r) => (
              <ConsentCard key={`${r.request.id}-${r.student.id}`} row={r} lang={lang} dict={dict} closed={consentClosed(r.request.deadline, today)} multiChild={multiChild} />
            ))}
          </section>
        )}
      </>
    );
  }

  async function StaffSection() {
    const isAdmin = ctx.roles.includes("ADMIN");
    const [requests, classes, levels] = await Promise.all([
      listConsentsForStaff(ctx),
      managedClasses(ctx),
      isAdmin ? db.gradeLevel.findMany({ where: { schoolId: ctx.school.id, classGroups: { some: { academicYear: { isCurrent: true } } } }, orderBy: { rank: "asc" } }) : [],
    ]);
    // Nombre d'élèves concernés par chaque demande (pour « sans réponse »).
    const sizes = new Map(await Promise.all(requests.map(async (r) => [r.id, (await consentStudents(ctx.school.id, r)).length] as const)));
    return (
      <>
        {classes.length > 0 && (
          <Card title={c.new}>
            <ActionForm action={createConsent.bind(null, lang)} labels={{ ...formLabels(dict, c.send), errors: dict.formErrors as Record<string, string> }}>
              <Field label={c.titleLabel}>
                <Input name="title" required minLength={3} maxLength={160} dir="auto" placeholder={c.titlePlaceholder} />
              </Field>
              <Field label={`${c.details} (${dict.common.optional})`}>
                <Textarea name="details" rows={3} maxLength={3000} dir="auto" placeholder={c.detailsPlaceholder} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={c.audience}>
                  <Select name="audience" defaultValue={isAdmin ? "SCHOOL" : `class:${classes[0].id}`}>
                    {isAdmin && <option value="SCHOOL">{dict.messages.audiences.SCHOOL}</option>}
                    {levels.map((l) => (
                      <option key={l.id} value={`level:${l.id}`}>{pickName(l, lang)}</option>
                    ))}
                    {classes.map((cl) => (
                      <option key={cl.id} value={`class:${cl.id}`}>{className(cl, lang)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={`${c.deadline} (${dict.common.optional})`}>
                  <Input name="deadline" type="date" min={today} />
                </Field>
              </div>
            </ActionForm>
          </Card>
        )}
        <Card title={c.list}>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">{c.none}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.map((r) => {
                const yes = r.replies.filter((x) => x.accepted).length;
                const no = r.replies.length - yes;
                const total = sizes.get(r.id) ?? 0;
                return (
                  <li key={r.id}>
                    <Link href={`/${lang}/autorisations/${r.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-gold-50">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-900"><FileSignature size={19} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold" dir="auto">{r.title}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {t(c.counts, { yes, no, waiting: Math.max(0, total - yes - no) })}
                          {r.deadline ? ` · ${consentClosed(r.deadline, today) ? c.closed : t(c.before, { date: formatDay(r.deadline, lang) })}` : ""}
                        </span>
                        {total > 0 && (
                          <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200" dir="ltr">
                            <span className="bg-emerald-500" style={{ width: `${(yes / total) * 100}%` }} />
                            <span className="bg-red-400" style={{ width: `${(no / total) * 100}%` }} />
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }
}

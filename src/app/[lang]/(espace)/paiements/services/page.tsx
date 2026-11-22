import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCurrentYear } from "@/lib/data/school";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { Tabs } from "@/components/tabs";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { addToService, removeFromService, setServiceInfo } from "./actions";

/**
 * Listes des services (cantine, transport, activités) : qui est inscrit,
 * classe par classe, avec le téléphone du parent et l'effectif du jour.
 */
export default async function ServicesPage({ params, searchParams }: PageProps<"/[lang]/paiements/services">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "payments.read");
  const sv = dict.services;
  const schoolId = ctx.school.id;
  const year = await getCurrentYear(schoolId);
  const fees = year
    ? await db.fee.findMany({ where: { schoolId, academicYearId: year.id, isOptional: true }, orderBy: [{ name: "asc" }, { dueDate: "asc" }] })
    : [];
  const back = { href: `/${lang}/paiements`, label: dict.payments.title };
  if (fees.length === 0) return <PageHeader title={sv.title} subtitle={sv.noServices} back={back} />;

  const fee = fees.find((f) => f.id === sp.service) ?? fees[0];
  const canWrite = can(ctx.roles, "payments.write");
  const today = parseISODate(todayISO())!;
  const [subs, absentToday, enrolled] = await Promise.all([
    db.studentFee.findMany({
      where: { schoolId, feeId: fee.id },
      include: {
        student: {
          include: {
            enrollments: { where: { academicYearId: fee.academicYearId, status: "ACTIVE" }, include: { classGroup: true } },
            guardians: { include: { guardian: true }, orderBy: { isPrimary: "desc" }, take: 1 },
          },
        },
      },
    }),
    db.attendanceRecord.findMany({ where: { schoolId, date: today, status: "ABSENT" }, select: { studentId: true } }),
    canWrite
      ? db.enrollment.findMany({
          where: { schoolId, academicYearId: fee.academicYearId, status: "ACTIVE", ...(fee.gradeLevelId ? { classGroup: { gradeLevelId: fee.gradeLevelId } } : {}) },
          include: { student: true, classGroup: true },
          orderBy: [{ classGroup: { name: "asc" } }, { student: { lastName: "asc" } }],
        })
      : [],
  ]);
  const absent = new Set(absentToday.map((a) => a.studentId));
  const rows = subs
    .filter((s) => s.student.enrollments.length > 0)
    .map((s) => ({ ...s, cls: s.student.enrollments[0].classGroup, guardian: s.student.guardians[0]?.guardian ?? null }))
    .sort((a, b) => a.cls.name.localeCompare(b.cls.name) || a.student.lastName.localeCompare(b.student.lastName));
  const present = rows.filter((r) => !absent.has(r.studentId)).length;
  const subscribed = new Set(rows.map((r) => r.studentId));
  const candidates = enrolled.filter((e) => !subscribed.has(e.studentId));
  const classes = [...new Map(enrolled.map((e) => [e.classGroupId, e.classGroup])).values()];
  const byClass = new Map<string, typeof rows>();
  for (const r of rows) byClass.set(r.cls.id, [...(byClass.get(r.cls.id) ?? []), r]);
  const feeName = (f: (typeof fees)[number]) => (lang === "ar" && f.nameAr ? f.nameAr : f.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader title={sv.title} subtitle={sv.intro} back={back} action={<PrintButton label={sv.print} />} />
      </div>
      <div className="print:hidden">
        <Tabs active={fee.id} items={fees.map((f) => ({ key: f.id, href: `/${lang}/paiements/services?service=${f.id}`, label: feeName(f) }))} />
      </div>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
          <p className="text-xs text-slate-500">{sv.subscribed}</p>
          <p className="text-2xl font-bold text-blue-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
          <p className="text-xs text-slate-500">{sv.presentToday}</p>
          <p className="text-2xl font-bold text-emerald-700">{present}</p>
          {rows.length > present && <p className="text-xs text-slate-500">{t(sv.absentToday, { count: rows.length - present })}</p>}
        </div>
      </section>

      <Card title={feeName(fee)}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">{sv.none}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...byClass.values()].map((list) => (
              <section key={list[0].cls.id}>
                <h3 className="mb-1.5 text-sm font-bold text-slate-700">
                  {className(list[0].cls, lang)} · {list.length}
                </h3>
                <ul className="flex flex-col gap-1">
                  {list.map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm print:bg-white print:py-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-semibold">{personName(r.student, lang)}</span>
                        {absent.has(r.studentId) && <span className="rounded-full bg-red-50 px-2 text-xs font-semibold text-red-700 ring-1 ring-red-200">{sv.absent}</span>}
                        {r.guardian?.phone && <bdi dir="ltr" className="text-slate-600">{r.guardian.phone}</bdi>}
                        {r.serviceInfo && <span className="text-slate-700">· {r.serviceInfo}</span>}
                      </div>
                      {canWrite && (
                        <details className="mt-1 print:hidden">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-800">{dict.common.edit}</summary>
                          <div className="mt-2 flex flex-col gap-2">
                            <ActionForm action={setServiceInfo.bind(null, lang, fee.id, r.studentId)} labels={formLabels(dict, dict.common.save)}>
                              <Input name="info" maxLength={200} defaultValue={r.serviceInfo ?? ""} placeholder={sv.infoPlaceholder} aria-label={sv.info} />
                            </ActionForm>
                            <ActionForm action={removeFromService.bind(null, lang, fee.id, r.studentId)} labels={formLabels(dict, sv.remove)} variant="danger" confirm={sv.confirmRemove} />
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      {canWrite && candidates.length > 0 && (
        <Card title={sv.add} className="print:hidden">
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionForm action={addToService.bind(null, lang, fee.id)} labels={formLabels(dict, sv.addOne)} resetOnSuccess>
              <Select name="studentId" required defaultValue="" aria-label={dict.messages.student}>
                <option value="" disabled>—</option>
                {candidates.map((e) => (
                  <option key={e.studentId} value={e.studentId}>{personName(e.student, lang)} ({e.classGroup.name})</option>
                ))}
              </Select>
            </ActionForm>
            <ActionForm action={addToService.bind(null, lang, fee.id)} labels={formLabels(dict, sv.addClass)}>
              <Select name="classGroupId" required defaultValue="" aria-label={sv.wholeClass}>
                <option value="" disabled>{sv.wholeClass}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{className(c, lang)}</option>
                ))}
              </Select>
            </ActionForm>
          </div>
          <p className="mt-3 text-xs text-slate-500">{sv.billingHint}</p>
        </Card>
      )}
    </div>
  );
}

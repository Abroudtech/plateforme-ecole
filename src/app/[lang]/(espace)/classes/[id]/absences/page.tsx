import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClass } from "@/lib/data/classes";
import { getRollCall } from "@/lib/data/attendance";
import { currentPeriod, parseISODate, todayISO, toISODate } from "@/lib/dates";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { ClassTabs } from "../../class-tabs";
import { saveRollCall } from "../../../absences/actions";

const OPTIONS = [
  { value: "PRESENT", key: "present", on: "peer-checked:bg-green-600 peer-checked:text-white" },
  { value: "ABSENT", key: "absent", on: "peer-checked:bg-red-600 peer-checked:text-white" },
  { value: "LATE", key: "late", on: "peer-checked:bg-amber-500 peer-checked:text-white" },
] as const;

export default async function RollCallPage({ params, searchParams }: PageProps<"/[lang]/classes/[id]/absences">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "attendance.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();

  const date = parseISODate(typeof sp.date === "string" ? sp.date : null) ?? parseISODate(todayISO())!;
  const period = sp.periode === "MORNING" || sp.periode === "AFTERNOON" ? sp.periode : currentPeriod();
  const { rollCall, records } = await getRollCall(ctx.school.id, cls.id, date, period);
  const canWrite = can(ctx.roles, "attendance.write");
  const a = dict.attendance;
  const dateISO = toISODate(date);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={a.rollCall} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="attendance" />

      {/* Choix de la date et du moment de la journée */}
      <form className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Input name="date" type="date" defaultValue={dateISO} aria-label={a.date} />
        </div>
        <div className="w-36">
          <Select name="periode" defaultValue={period} aria-label={a.period}>
            <option value="MORNING">{a.periods.MORNING}</option>
            <option value="AFTERNOON">{a.periods.AFTERNOON}</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">{a.show}</Button>
      </form>

      <Card>
        <p className={`mb-3 text-sm ${rollCall ? "text-green-700" : "text-amber-700"}`}>{rollCall ? a.done : a.notDone}</p>
        <ActionForm action={saveRollCall.bind(null, lang, cls.id, dateISO, period)} labels={formLabels(dict, a.saveRollCall)}>
          <ol className="divide-y divide-slate-100">
            {cls.enrollments.map(({ student }) => {
              const current = records.get(student.id)?.status ?? "PRESENT";
              return (
                <li key={student.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{personName(student, lang)}</span>
                  <fieldset className="flex gap-1" disabled={!canWrite}>
                    <legend className="sr-only">{personName(student, lang)}</legend>
                    {OPTIONS.map((o) => (
                      <label key={o.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`status_${student.id}`}
                          value={o.value}
                          defaultChecked={current === o.value}
                          className="peer sr-only"
                        />
                        <span className={`block rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 ${o.on}`}>
                          {a[o.key]}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </li>
              );
            })}
          </ol>
        </ActionForm>
      </Card>
    </div>
  );
}

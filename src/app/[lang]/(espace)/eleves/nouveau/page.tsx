import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { requirePermission } from "@/lib/auth/context";
import { listClasses } from "@/lib/data/classes";
import { getCurrentYear } from "@/lib/data/school";
import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { createStudent } from "../actions";
import { GuardianFields, StudentFields } from "../fields";

export default async function NewStudentPage({ params, searchParams }: PageProps<"/[lang]/eleves/nouveau">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const preselected = typeof sp.classe === "string" ? sp.classe : "";
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.write");
  const year = await getCurrentYear(ctx.school.id);
  const classes = year ? await listClasses(ctx.school.id, year.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={dict.students.add} back={{ href: `/${lang}/eleves`, label: dict.students.title }} />
      <ActionForm action={createStudent.bind(null, lang)} labels={formLabels(dict, dict.students.createAndContinue)}>
        <Card title={dict.students.identity}>
          <StudentFields dict={dict} />
        </Card>
        <Card title={dict.students.class}>
          <Field label={year ? t(dict.students.enrollment, { year: ltr(year.label) }) : dict.students.class}>
            <Select name="classGroupId" defaultValue={preselected}>
              <option value="">{dict.students.noClass}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{lang === "ar" && c.nameAr ? c.nameAr : c.name}</option>
              ))}
            </Select>
          </Field>
        </Card>
        <Card title={`${dict.guardians.title} (${dict.common.optional})`}>
          <GuardianFields dict={dict} prefix="guardian." required={false} showPrimary={false} />
        </Card>
      </ActionForm>
    </div>
  );
}

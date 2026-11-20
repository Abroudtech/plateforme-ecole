import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listClasses } from "@/lib/data/classes";
import { getCurrentYear } from "@/lib/data/school";
import { getStudent } from "@/lib/data/students";
import { getStudentAttendance } from "@/lib/data/attendance";
import { AttendanceList } from "@/components/attendance-list";
import { ActionForm } from "@/components/action-form";
import { ButtonLink, Card, Field, PageHeader, Select } from "@/components/ui";
import {
  addGuardian,
  createGuardianAccess,
  setEnrollment,
  setStudentActive,
  unlinkGuardian,
  updateGuardian,
  updateStudent,
} from "../actions";
import { GuardianFields, StudentFields } from "../fields";

export default async function StudentPage({ params }: PageProps<"/[lang]/eleves/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.read");
  const year = await getCurrentYear(ctx.school.id);
  const student = await getStudent(ctx.school.id, id, year?.id ?? null);
  if (!student) notFound();
  const canWrite = can(ctx.roles, "students.write");
  const classes = year && canWrite ? await listClasses(ctx.school.id, year.id) : [];
  const enrollment = student.enrollments[0];
  const attendance = await getStudentAttendance(ctx.school.id, student.id, year?.startDate);
  const labels = formLabels(dict);
  const g = dict.guardians;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={personName(student, lang)}
        subtitle={
          <>
            <bdi>{student.studentNumber}</bdi>
            {" · "}
            {enrollment
              ? `${pickName(enrollment.classGroup.gradeLevel, lang)} · ${lang === "ar" && enrollment.classGroup.nameAr ? enrollment.classGroup.nameAr : enrollment.classGroup.name}`
              : dict.students.noClass}
            {!student.isActive && <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{dict.students.withdrawn}</span>}
          </>
        }
        back={{ href: `/${lang}/eleves`, label: dict.students.title }}
        action={
          enrollment ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/${lang}/eleves/${student.id}/bulletin`}>{dict.reportCards.view}</ButtonLink>
              {can(ctx.roles, "payments.read") && (
                <ButtonLink href={`/${lang}/eleves/${student.id}/paiements`}>{dict.payments.myPayments}</ButtonLink>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Inscription dans une classe de l'année en cours */}
      {canWrite && year && student.isActive && (
        <Card title={t(dict.students.enrollment, { year: ltr(year.label) })}>
          <ActionForm action={setEnrollment.bind(null, lang, student.id)} labels={labels} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label={dict.students.class}>
                <Select name="classGroupId" defaultValue={enrollment?.classGroupId ?? ""}>
                  <option value="">{dict.students.noClass}</option>
                  {classes.map((c) => {
                    const full = c.capacity != null && c._count.enrollments >= c.capacity && c.id !== enrollment?.classGroupId;
                    return (
                      <option key={c.id} value={c.id}>
                        {lang === "ar" && c.nameAr ? c.nameAr : c.name} · {pickName(c.gradeLevel, lang)}
                        {full ? ` (${dict.classes.full})` : ""}
                      </option>
                    );
                  })}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}

      {/* Absences de l'année */}
      <Card title={dict.attendance.history}>
        <p className="mb-3 text-sm text-slate-600">{t(dict.attendance.summary, attendance.summary)}</p>
        <AttendanceList
          records={attendance.records}
          dict={dict}
          lang={lang}
          canWrite={can(ctx.roles, "attendance.write")}
          renderLabel={(r) => dict.attendance.statuses[r.status]}
        />
      </Card>

      {/* Parents et tuteurs */}
      <Card title={g.title}>
        {student.guardians.length === 0 && <p className="mb-3 text-sm text-slate-500">{g.none}</p>}
        <ul className="flex flex-col gap-3">
          {student.guardians.map(({ guardian, relationship, isPrimary }) => (
            <li key={guardian.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {personName(guardian, lang)}
                  <span className="ms-2 text-sm font-normal text-slate-500">{g.relationships[relationship]}</span>
                  {isPrimary && <span className="ms-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{g.primary}</span>}
                </p>
                <span className={`text-xs ${guardian.userId ? "text-green-700" : "text-slate-500"}`}>
                  {guardian.userId ? g.hasAccount : g.noAccount}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {guardian.phone && <bdi dir="ltr" className="me-3">{guardian.phone}</bdi>}
                {guardian.email && <bdi dir="ltr">{guardian.email}</bdi>}
              </p>

              {canWrite && (
                <div className="mt-3 flex flex-col gap-3">
                  <ActionForm
                    action={createGuardianAccess.bind(null, lang, guardian.id)}
                    labels={{
                      ...formLabels(dict, guardian.userId ? g.resetPassword : g.createAccount),
                      credentials: { intro: g.accountCreated, login: g.login, password: g.tempPassword },
                    }}
                    variant="secondary"
                    confirm={guardian.userId ? `${g.resetPassword} ?` : undefined}
                  />
                  <details className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">{dict.common.edit}</summary>
                    <div className="mt-3 flex flex-col gap-4">
                      <ActionForm action={updateGuardian.bind(null, lang, student.id, guardian.id)} labels={labels}>
                        <GuardianFields dict={dict} value={guardian} relationship={relationship} isPrimary={isPrimary} />
                      </ActionForm>
                      <ActionForm
                        action={unlinkGuardian.bind(null, lang, student.id, guardian.id)}
                        labels={formLabels(dict, g.unlink)}
                        variant="danger"
                        confirm={`${g.unlink} ?`}
                      />
                    </div>
                  </details>
                </div>
              )}
            </li>
          ))}
        </ul>

        {canWrite && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-blue-700">{g.add}</summary>
            <div className="mt-3">
              <ActionForm action={addGuardian.bind(null, lang, student.id)} labels={formLabels(dict, dict.common.add)} resetOnSuccess>
                <GuardianFields dict={dict} isPrimary={student.guardians.length === 0} />
              </ActionForm>
            </div>
          </details>
        )}
      </Card>

      {/* Identité */}
      <Card title={dict.students.identity}>
        {canWrite ? (
          <ActionForm action={updateStudent.bind(null, lang, student.id)} labels={labels}>
            <StudentFields dict={dict} value={student} />
          </ActionForm>
        ) : (
          <p>{personName(student, lang)}</p>
        )}
      </Card>

      {canWrite && (
        <Card>
          <p className="mb-3 text-sm text-slate-600">{student.isActive ? dict.students.withdrawHint : dict.students.withdrawn}</p>
          <ActionForm
            action={setStudentActive.bind(null, lang, student.id, !student.isActive)}
            labels={formLabels(dict, student.isActive ? dict.students.withdraw : dict.students.reactivate)}
            variant={student.isActive ? "danger" : "secondary"}
            confirm={student.isActive ? `${dict.students.withdraw} ?` : undefined}
          />
        </Card>
      )}
    </div>
  );
}

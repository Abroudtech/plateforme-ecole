import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { STUDENT_ATTESTATIONS, studentAttestation, type StudentAttestation } from "@/lib/attestations";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { schoolLogoUrl } from "@/lib/data/attestations";
import { AttestationControls } from "@/components/attestation-controls";
import { AttestationDoc } from "@/components/attestation-doc";
import { PageHeader } from "@/components/ui";

/** Attestation de présence ou de scolarité d'un élève, prête à imprimer (ou enregistrer en PDF). */
export default async function StudentAttestationPage({ params, searchParams }: PageProps<"/[lang]/eleves/[id]/attestation">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const A = dict.attestations;
  const ctx = await requirePermission(lang, "attestations.write");
  const school = ctx.school;
  const student = await db.student.findFirst({
    where: { id, schoolId: school.id },
    include: {
      enrollments: {
        include: { academicYear: true, classGroup: { include: { gradeLevel: true } } },
        orderBy: { academicYear: { startDate: "asc" } },
      },
    },
  });
  if (!student) notFound();

  const current = student.enrollments.find((e) => e.academicYear.isCurrent && e.status === "ACTIVE");
  const docLang = sp.langue === "ar" || sp.langue === "fr" ? sp.langue : lang;
  const asked = STUDENT_ATTESTATIONS.find((k) => k === sp.type);
  const kind: StudentAttestation = asked === "scolarite" || !current ? "scolarite" : "presence";
  const date = typeof sp.date === "string" && parseISODate(sp.date) ? sp.date : todayISO();

  // Années passées dans l'école (une par année scolaire), jusqu'à l'année en cours.
  const byYear = new Map<string, (typeof student.enrollments)[number]>();
  for (const e of student.enrollments) byYear.set(e.academicYearId, e);
  const years = [...byYear.values()].map((e) => ({ label: e.academicYear.label, level: e.classGroup.gradeLevel }));
  const presenceYears = current ? [{ label: current.academicYear.label, level: current.classGroup.gradeLevel }] : [];

  const doc = studentAttestation(
    kind,
    docLang,
    school,
    { name: personName(student, docLang), gender: student.gender, birthDate: student.birthDate, birthPlace: student.birthPlace },
    kind === "presence" ? presenceYears : years,
    parseISODate(date)!,
  );

  const missing = [
    !student.birthDate && dict.students.birthDate,
    !student.gender && dict.students.gender,
    docLang === "ar" && !(student.firstNameAr && student.lastNameAr) && dict.students.firstNameAr,
  ].filter((x): x is string => !!x);
  const warnings = [
    ...(!school.directorName && !school.directorNameAr ? [A.missingDirector] : []),
    ...(!current ? [years.length ? A.notEnrolled : A.neverEnrolled] : []),
    ...(missing.length ? [t(A.missing, { fields: missing.join(", ") })] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      <div className="print:hidden">
        <PageHeader title={A.title} subtitle={personName(student, lang)} back={{ href: `/${lang}/eleves/${student.id}`, label: personName(student, lang) }} />
      </div>
      <AttestationControls
        dict={dict}
        kinds={[
          { value: "presence", label: A.presence, disabled: !current },
          { value: "scolarite", label: A.scolarite },
        ]}
        kind={kind}
        docLang={docLang}
        date={date}
        warnings={warnings}
        settingsHref={`/${lang}/parametres`}
      />
      {years.length > 0 && <AttestationDoc doc={doc} lang={docLang} school={school} logoUrl={await schoolLogoUrl(school.id)} signatureLabel={docLang === "ar" ? "الإمضاء والختم" : "Signature et cachet"} />}
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { workAttestation } from "@/lib/attestations";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { schoolLogoUrl } from "@/lib/data/attestations";
import { AttestationControls } from "@/components/attestation-controls";
import { AttestationDoc } from "@/components/attestation-doc";
import { PageHeader } from "@/components/ui";

/** Attestation de travail d'un enseignant, prête à imprimer (ou enregistrer en PDF). */
export default async function TeacherAttestationPage({ params, searchParams }: PageProps<"/[lang]/enseignants/[id]/attestation">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const A = dict.attestations;
  const ctx = await requirePermission(lang, "attestations.write");
  const school = ctx.school;
  const teacher = await db.teacher.findFirst({
    where: { id, schoolId: school.id },
    include: { entries: { where: { classGroup: { academicYear: { isCurrent: true } } }, include: { subject: true } } },
  });
  if (!teacher) notFound();

  const docLang = sp.langue === "ar" || sp.langue === "fr" ? sp.langue : lang;
  const date = typeof sp.date === "string" && parseISODate(sp.date) ? sp.date : todayISO();
  const subjects = [...new Map(teacher.entries.map((e) => [e.subjectId, e.subject])).values()].map((s) =>
    docLang === "ar" ? s.nameAr || s.nameFr : s.nameFr.toLowerCase(),
  );
  const doc = workAttestation(
    docLang,
    school,
    { name: personName(teacher, docLang), gender: teacher.gender, cin: teacher.cin, hiredOn: teacher.hiredOn, subjects },
    parseISODate(date)!,
  );

  const T = dict.teachers;
  const missing = [
    !teacher.gender && T.gender,
    !teacher.cin && T.cin,
    !teacher.hiredOn && T.hiredOn,
    docLang === "ar" && !(teacher.firstNameAr && teacher.lastNameAr) && dict.students.firstNameAr,
  ].filter((x): x is string => !!x);
  const warnings = [
    ...(!school.directorName && !school.directorNameAr ? [A.missingDirector] : []),
    ...(missing.length ? [t(A.missing, { fields: missing.join(", ") })] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      <div className="print:hidden">
        <PageHeader title={A.title} subtitle={personName(teacher, lang)} back={{ href: `/${lang}/enseignants/${teacher.id}`, label: personName(teacher, lang) }} />
      </div>
      <AttestationControls dict={dict} kinds={[{ value: "travail", label: A.work }]} kind="travail" docLang={docLang} date={date} warnings={warnings} settingsHref={`/${lang}/parametres`} />
      <AttestationDoc doc={doc} lang={docLang} school={school} logoUrl={await schoolLogoUrl(school.id)} signatureLabel={docLang === "ar" ? "الإمضاء والختم" : "Signature et cachet"} />
    </div>
  );
}

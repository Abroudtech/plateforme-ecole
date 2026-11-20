import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { personName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getStudentClass, isGuardianOf } from "@/lib/data/grades";
import { getCurrentYear } from "@/lib/data/school";
import { getClassTimetable } from "@/lib/data/timetable";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { WeekTimetable } from "@/components/week-timetable";

/** Emploi du temps de la classe d'un élève, en lecture seule (parents). */
export default async function StudentTimetablePage({ params }: PageProps<"/[lang]/eleves/[id]/emploi-du-temps">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const schoolId = ctx.school.id;
  const isStaff = can(ctx.roles, "timetable.read");
  if (!isStaff && !(can(ctx.roles, "children.read") && (await isGuardianOf(schoolId, ctx.user.id, id)))) {
    redirect(`/${lang}/acces-refuse`);
  }
  const student = await db.student.findFirst({ where: { id, schoolId } });
  const year = await getCurrentYear(schoolId);
  const enrollment = student && year ? await getStudentClass(schoolId, id, year.id) : null;
  if (!student || !enrollment) notFound();
  const entries = await getClassTimetable(schoolId, enrollment.classGroupId);
  const cls = enrollment.classGroup;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={personName(student, lang)}
        subtitle={`${dict.timetable.myTimetable} · ${lang === "ar" && cls.nameAr ? cls.nameAr : cls.name}`}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
        action={<PrintButton label={dict.reportCards.print} />}
      />
      <WeekTimetable entries={entries} dict={dict} lang={lang} show="teacher" />
    </div>
  );
}

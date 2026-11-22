import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { isGuardianOf } from "@/lib/data/grades";
import { homeworkForStudent } from "@/lib/data/homework";
import { StudentHomework } from "@/components/homework-entry";
import { PageHeader } from "@/components/ui";

/** Espace parent : cahier de textes et devoirs d'un enfant. */
export default async function ChildHomeworkPage({ params }: PageProps<"/[lang]/eleves/[id]/devoirs">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "children.read");
  if (!(await isGuardianOf(ctx.school.id, ctx.user.id, id))) redirect(`/${lang}/acces-refuse`);
  const student = await db.student.findFirst({ where: { id, schoolId: ctx.school.id } });
  if (!student) notFound();
  const data = await homeworkForStudent(ctx.school.id, id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={dict.homework.title}
        subtitle={personName(student, lang) + (data ? ` · ${className(data.classGroup, lang)}` : "")}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
      />
      <StudentHomework data={data} lang={lang} dict={dict} />
    </div>
  );
}

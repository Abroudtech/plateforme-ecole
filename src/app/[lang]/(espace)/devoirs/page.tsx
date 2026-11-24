import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { studentOf } from "@/lib/data/class-space";
import { homeworkForStudent } from "@/lib/data/homework";
import { StudentHomework } from "@/components/homework-entry";
import { PageHeader } from "@/components/ui";
import { toggleHomeworkDone } from "./actions";

/** Espace élève : ses devoirs et le cahier de textes de sa classe. */
export default async function MyHomeworkPage({ params }: PageProps<"/[lang]/devoirs">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "student.space");
  const student = await studentOf(ctx.school.id, ctx.user.id);
  const data = student ? await homeworkForStudent(ctx.school.id, student.id) : null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={dict.homework.myHomework} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <StudentHomework data={data} lang={lang} dict={dict} toggle={(id) => toggleHomeworkDone.bind(null, lang, id)} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { ltr, t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClass, getLevelsAndTracks } from "@/lib/data/classes";
import { ActionForm } from "@/components/action-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { deleteClass, saveClass } from "../actions";
import { ClassFields } from "../class-fields";
import { ClassTabs } from "../class-tabs";

export default async function ClassPage({ params }: PageProps<"/[lang]/classes/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classes.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();
  const canWrite = can(ctx.roles, "classes.write");
  const { levels, tracks } = canWrite
    ? await getLevelsAndTracks(ctx.school.id, ctx.school.cycles)
    : { levels: [], tracks: [] };
  const count = cls.enrollments.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name}
        subtitle={`${dict.cycles[cls.gradeLevel.cycle]} · ${pickName(cls.gradeLevel, lang)}${cls.track ? ` · ${pickName(cls.track, lang)}` : ""} · ${ltr(cls.academicYear.label)}`}
        back={{ href: `/${lang}/classes`, label: dict.classes.title }}
        action={canWrite ? <ButtonLink href={`/${lang}/eleves/nouveau?classe=${cls.id}`}>{dict.students.add}</ButtonLink> : undefined}
      />

      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="students" />

      <Card
        title={`${dict.classes.students} (${cls.capacity ? t(dict.classes.seats, { count, capacity: cls.capacity }) : count})`}
      >
        {count === 0 ? (
          <p className="text-sm text-slate-500">{dict.classes.empty}</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {cls.enrollments.map((e, i) => (
              <li key={e.id}>
                <Link href={`/${lang}/eleves/${e.student.id}`} className="flex items-center gap-3 py-2.5 hover:text-blue-700">
                  <span className="w-6 text-sm text-slate-400">{i + 1}</span>
                  <span className="flex-1 font-medium">{personName(e.student, lang)}</span>
                  <bdi className="text-sm text-slate-500">{e.student.studentNumber}</bdi>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {canWrite && (
        <Card title={dict.common.edit}>
          <ActionForm action={saveClass.bind(null, lang, cls.id)} labels={formLabels(dict)}>
            <ClassFields dict={dict} lang={lang} levels={levels} tracks={tracks} value={cls} />
          </ActionForm>
        </Card>
      )}

      {canWrite && count === 0 && (
        <ActionForm
          action={deleteClass.bind(null, lang, cls.id)}
          labels={formLabels(dict, dict.classes.delete)}
          variant="danger"
          confirm={dict.classes.delete + " ?"}
        />
      )}
    </div>
  );
}

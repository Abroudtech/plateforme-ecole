import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { teacherOf } from "@/lib/auth/scope";
import { getClass } from "@/lib/data/classes";
import { getClassCurriculum } from "@/lib/data/grades";
import { listClassHomework } from "@/lib/data/homework";
import { todayISO, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { formatDay, HomeworkEntry } from "@/components/homework-entry";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ClassTabs } from "../../class-tabs";
import { deleteHomework, saveHomework } from "./actions";

/** Cahier de textes de la classe : l'enseignant note la séance et le travail à faire. */
export default async function HomeworkPage({ params, searchParams }: PageProps<"/[lang]/classes/[id]/cahier">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classes.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();
  const h = dict.homework;
  const isAdmin = ctx.roles.includes("ADMIN");
  const canWrite = can(ctx.roles, "homework.write");

  const teacher = await teacherOf(ctx.school.id, ctx.user.id);
  const [items, curriculum, myEntries, resources] = await Promise.all([
    listClassHomework(ctx.school.id, cls.id),
    getClassCurriculum(ctx.school.id, cls),
    teacher ? db.timetableEntry.findMany({ where: { schoolId: ctx.school.id, classGroupId: cls.id, teacherId: teacher.id }, select: { subjectId: true, dayOfWeek: true } }) : [],
    canWrite
      ? db.teachingResource.findMany({
          where: { schoolId: ctx.school.id, gradeLevelId: cls.gradeLevelId, ...(isAdmin ? {} : { authorId: ctx.user.id }) },
          select: { id: true, title: true },
          orderBy: { createdAt: "desc" },
          take: 40,
        })
      : [],
  ]);
  const editing = typeof sp.modifier === "string" ? items.find((x) => x.id === sp.modifier && (isAdmin || x.authorId === ctx.user.id)) : undefined;

  // Matière proposée : celle que l'enseignant a aujourd'hui dans cette classe, sinon sa première matière.
  const today = todayISO();
  const dow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const mine = [...new Set(myEntries.map((e) => e.subjectId))];
  const subjects = curriculum.map((c) => c.subject);
  for (const e of myEntries) if (!subjects.some((s) => s.id === e.subjectId)) {
    const s = await db.subject.findUnique({ where: { id: e.subjectId } });
    if (s) subjects.push(s);
  }
  const defaultSubject = editing ? editing.subjectId ?? "" : myEntries.find((e) => e.dayOfWeek === dow)?.subjectId ?? mine[0] ?? "";

  // Regroupement par jour de séance.
  const days = new Map<string, typeof items>();
  for (const it of items) {
    const k = toISODate(it.date);
    days.set(k, [...(days.get(k) ?? []), it]);
  }
  const base = `/${lang}/classes/${cls.id}/cahier`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={h.title} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="homework" />

      {canWrite && (
        <Card title={editing ? h.edit : h.add}>
          <ActionForm
            key={editing?.id ?? "new"}
            action={saveHomework.bind(null, lang, cls.id, editing?.id ?? null)}
            labels={formLabels(dict, dict.common.save)}
            resetOnSuccess={!editing}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={h.date}>
                <Input name="date" type="date" required defaultValue={editing ? toISODate(editing.date) : today} />
              </Field>
              <Field label={h.subject}>
                <Select name="subjectId" defaultValue={defaultSubject}>
                  <option value="">{h.general}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{pickName(s, lang)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={h.dueDate} hint={h.dueHint}>
                <Input name="dueDate" type="date" defaultValue={editing?.dueDate ? toISODate(editing.dueDate) : ""} />
              </Field>
            </div>
            <Field label={h.lesson}>
              <Textarea name="lesson" rows={2} maxLength={4000} dir="auto" defaultValue={editing?.lesson ?? ""} placeholder={h.lessonPlaceholder} />
            </Field>
            <Field label={h.task}>
              <Textarea name="task" rows={2} maxLength={4000} dir="auto" defaultValue={editing?.task ?? ""} placeholder={h.taskPlaceholder} />
            </Field>
            {resources.length > 0 && (
              <Field label={h.resource} hint={h.resourceHint}>
                <Select name="resourceId" defaultValue={editing?.resourceId ?? ""}>
                  <option value="">—</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </Select>
              </Field>
            )}
            <p className="text-xs text-slate-500">{h.visibleHint}</p>
          </ActionForm>
          {editing && (
            <Link href={base} className="mt-3 inline-block text-sm font-semibold text-blue-800 hover:underline">{dict.common.cancel}</Link>
          )}
        </Card>
      )}

      <Card title={h.title}>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{h.none}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {[...days.entries()].map(([day, list]) => (
              <section key={day}>
                <h3 className="mb-2 text-sm font-bold capitalize text-slate-700">{formatDay(list[0].date, lang)}</h3>
                <div className="flex flex-col gap-2">
                  {list.map((it) => (
                    <HomeworkEntry
                      key={it.id}
                      item={it}
                      lang={lang}
                      dict={dict}
                      showAuthor
                      actions={
                        canWrite && (isAdmin || it.authorId === ctx.user.id) ? (
                          <>
                            <Link href={`${base}?modifier=${it.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">{h.editShort}</Link>
                            <ActionForm action={deleteHomework.bind(null, lang, cls.id, it.id)} labels={formLabels(dict, dict.common.remove)} variant="danger" confirm={h.confirmDelete} />
                          </>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

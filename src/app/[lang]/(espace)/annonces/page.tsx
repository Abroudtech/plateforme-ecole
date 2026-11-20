import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listClasses, getLevelsAndTracks } from "@/lib/data/classes";
import { getGuardianForUser, listAnnouncementsFor, parentScope } from "@/lib/data/messages";
import { getCurrentYear } from "@/lib/data/school";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { createAnnouncement, deleteAnnouncement } from "../messages/actions";

export default async function AnnouncementsPage({ params }: PageProps<"/[lang]/annonces">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const m = dict.messages;
  const canWrite = can(ctx.roles, "announcements.write");
  const year = await getCurrentYear(ctx.school.id);
  let scope: { levelIds: string[]; classIds: string[] } | null = null;
  if (!canWrite) {
    const g = await getGuardianForUser(ctx.school.id, ctx.user.id);
    scope = g ? await parentScope(ctx.school.id, g.id, year?.id ?? null) : { levelIds: [], classIds: [] };
  }
  const announcements = await listAnnouncementsFor(ctx.school.id, scope);
  const [{ levels }, classes] = canWrite
    ? await Promise.all([getLevelsAndTracks(ctx.school.id, ctx.school.cycles), year ? listClasses(ctx.school.id, year.id) : Promise.resolve([])])
    : [{ levels: [] }, []];
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "long", timeZone: "Africa/Tunis" });
  const target = (a: (typeof announcements)[number]) =>
    a.audience === "SCHOOL"
      ? m.audiences.SCHOOL
      : a.audience === "LEVEL" && a.gradeLevel
        ? pickName(a.gradeLevel, lang)
        : a.classGroup
          ? lang === "ar" && a.classGroup.nameAr ? a.classGroup.nameAr : a.classGroup.name
          : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={m.announcements} back={{ href: `/${lang}/messages`, label: m.title }} />
      {canWrite && (
        <Card title={m.newAnnouncement}>
          <ActionForm action={createAnnouncement.bind(null, lang)} labels={formLabels(dict, m.publish)} resetOnSuccess>
            <Field label={m.annTitle}>
              <Input name="title" required maxLength={120} />
            </Field>
            <Field label={m.body}>
              <textarea name="body" required rows={4} maxLength={4000} dir="auto" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={m.audience}>
                <Select name="audience" defaultValue="SCHOOL">
                  {(["SCHOOL", "LEVEL", "CLASS"] as const).map((a) => (
                    <option key={a} value={a}>{m.audiences[a]}</option>
                  ))}
                </Select>
              </Field>
              <Field label={m.level} hint={m.audiences.LEVEL}>
                <Select name="gradeLevelId" defaultValue="">
                  <option value="">—</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>{pickName(l, lang)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={m.class} hint={m.audiences.CLASS}>
                <Select name="classGroupId" defaultValue="">
                  <option value="">—</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{lang === "ar" && c.nameAr ? c.nameAr : c.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="sendAlert" className="size-5" />
              {m.sendAlert}
            </label>
          </ActionForm>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        {announcements.length === 0 ? (
          <Card><p className="text-sm text-slate-500">{m.noAnnouncements}</p></Card>
        ) : (
          announcements.map((a) => (
            <Card key={a.id}>
              <p className="text-xs text-slate-500">{fmt.format(a.createdAt)} · {target(a)}</p>
              <h2 className="text-lg font-semibold" dir="auto">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap" dir="auto">{a.body}</p>
              {canWrite && (
                <ActionForm
                  action={deleteAnnouncement.bind(null, lang, a.id)}
                  labels={formLabels(dict, m.deleteAnnouncement)}
                  variant="danger"
                  confirm={`${m.deleteAnnouncement} ?`}
                  className="mt-2 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs"
                />
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

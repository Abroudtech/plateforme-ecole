import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { getGuardianForUser, isParentIn, listConversations, messagingViewer, teachersOfStudents } from "@/lib/data/messages";
import { getCurrentYear } from "@/lib/data/school";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { startConversation } from "./actions";

export default async function MessagesPage({ params, searchParams }: PageProps<"/[lang]/messages">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "messages.send");
  const m = dict.messages;
  const viewer = await messagingViewer(ctx);
  const schoolSide = viewer.schoolSide;
  if (!schoolSide && !viewer.guardianId && !viewer.teacherId) {
    const off = ctx.roles.includes("TEACHER") && !ctx.school.teacherMessaging;
    return <PageHeader title={m.title} subtitle={off ? m.teacherOff : m.none} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />;
  }
  const guardian = viewer.guardianId ? await getGuardianForUser(ctx.school.id, ctx.user.id) : null;
  const conversations = await listConversations(ctx.school.id, viewer);

  // Élèves que l'on peut choisir : tous ceux inscrits (direction), ceux de ses classes (enseignant), ses enfants (parent).
  const year = await getCurrentYear(ctx.school.id);
  const scope = schoolSide ? null : viewer.teacherId ? await scopeOf(ctx) : [];
  const enrolled =
    year && (scope === null || scope.length > 0)
      ? (
          await db.enrollment.findMany({
            where: { schoolId: ctx.school.id, academicYearId: year.id, status: "ACTIVE", ...(scope ? { classGroupId: { in: scope } } : {}) },
            include: { student: true, classGroup: true },
            orderBy: [{ classGroup: { name: "asc" } }, { student: { lastName: "asc" } }],
          })
        ).map((e) => ({ id: e.studentId, label: `${personName(e.student, lang)} (${e.classGroup.name})` }))
      : [];
  const children = guardian ? guardian.students.map((s) => ({ id: s.studentId, label: personName(s.student, lang) })) : [];
  const childIds = new Set(children.map((c) => c.id));
  const students = [...children, ...enrolled.filter((e) => !childIds.has(e.id))];
  // Le parent choisit à qui il écrit : la direction ou un enseignant de son enfant.
  const recipients = guardian && ctx.school.teacherMessaging ? await teachersOfStudents(ctx.school.id, [...childIds]) : [];
  const childName = new Map(children.map((c) => [c.id, c.label]));
  const parentOnly = !schoolSide && !viewer.teacherId;
  const preselect = typeof sp.eleve === "string" && students.some((s) => s.id === sp.eleve) ? sp.eleve : "";
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={m.title}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
        action={
          schoolSide ? (
            <div className="flex gap-2 text-sm">
              <Link href={`/${lang}/annonces`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50">{m.announcements}</Link>
              <Link href={`/${lang}/messages/alertes`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50">{m.alerts}</Link>
            </div>
          ) : parentOnly ? (
            <Link href={`/${lang}/annonces`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{m.announcements}</Link>
          ) : undefined
        }
      />
      <Card title={m.inbox}>
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-500">{m.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/messages/${c.id}`}
                  className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-blue-50 ${c.unread ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate ${c.unread ? "font-bold" : "font-semibold"}`}>{c.subject}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {isParentIn(c, viewer)
                        ? c.teacher ? personName(c.teacher, lang) : m.school
                        : t(m.withParent, { parent: personName(c.guardian, lang) }) + (schoolSide && c.teacher ? ` · ${personName(c.teacher, lang)}` : "")}
                      {c.student ? ` · ${personName(c.student, lang)}` : ""}
                    </span>
                    {c.last && <span className="block truncate text-sm text-slate-600">{c.last.body}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
                    {c.last && fmt.format(c.last.createdAt)}
                    {c.unread && <span className="rounded-full bg-blue-900 px-2 py-0.5 font-semibold text-white">{m.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={parentOnly ? m.parentWrites : m.new}>
        <ActionForm action={startConversation.bind(null, lang)} labels={formLabels(dict, m.send)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={parentOnly ? m.child : m.student}>
              <Select name="studentId" required defaultValue={preselect || (students.length === 1 ? students[0].id : "")}>
                <option value="" disabled>—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label={m.subject}>
              <Input name="subject" required maxLength={120} />
            </Field>
          </div>
          {recipients.length > 0 && (
            <Field label={m.to}>
              <Select name="to" defaultValue="school">
                <option value="school">{m.school}</option>
                {recipients.map((r) => (
                  <option key={r.teacher.id} value={r.teacher.id}>
                    {personName(r.teacher, lang)}
                    {r.subjects.length > 0 ? ` · ${r.subjects.map((x) => pickName(x, lang)).join(", ")}` : ""}
                    {children.length > 1 ? ` (${r.studentIds.map((id) => childName.get(id)).join(", ")})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={m.body}>
            <textarea name="body" required rows={4} maxLength={4000} dir="auto" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
          </Field>
          {!parentOnly && <p className="text-xs text-slate-500">{viewer.teacherId ? m.teacherHint : m.newHint}</p>}
          {recipients.length > 0 && <p className="text-xs text-slate-500">{m.toHint}</p>}
        </ActionForm>
      </Card>
    </div>
  );
}

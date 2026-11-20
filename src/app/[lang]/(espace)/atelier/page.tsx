import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { aiEnabled } from "@/lib/ai/generate";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { createResource } from "./actions";
import { WorkshopForm } from "./workshop-form";

/** Atelier pédagogique : l'IA prépare fiches, séries d'exercices et examens. */
export default async function WorkshopPage({ params }: PageProps<"/[lang]/atelier">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "ai.use");
  const w = dict.workshop;
  const schoolId = ctx.school.id;
  const isAdmin = ctx.roles.includes("ADMIN");

  const scope = await scopeOf(ctx);
  const [allLevels, subjects, curriculum, classes, resources] = await Promise.all([
    db.gradeLevel.findMany({ where: { schoolId, cycle: "PRIMARY" }, orderBy: { rank: "asc" } }),
    db.subject.findMany({ where: { schoolId }, orderBy: { nameFr: "asc" } }),
    db.curriculumSubject.findMany({ where: { schoolId }, select: { gradeLevelId: true, subjectId: true }, orderBy: { coefficient: "desc" } }),
    db.classGroup.findMany({
      where: { schoolId, academicYear: { isCurrent: true }, ...(scope ? { id: { in: scope } } : {}) },
      select: { gradeLevelId: true },
    }),
    db.teachingResource.findMany({
      // La direction voit tous les documents de l'école ; l'enseignant, les siens.
      where: { schoolId, ...(isAdmin ? {} : { authorId: ctx.user.id }) },
      include: { gradeLevel: true, subject: true, author: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  // Niveaux où l'on enseigne (ceux de ses classes pour un enseignant) en premier.
  const taught = new Set(classes.map((c) => c.gradeLevelId));
  const levels = [...allLevels.filter((l) => taught.has(l.id)), ...allLevels.filter((l) => !taught.has(l.id) && l.code !== "PREP")];
  const subjectsByLevel: Record<string, string[]> = {};
  for (const c of curriculum) {
    const list = (subjectsByLevel[c.gradeLevelId] ??= []);
    if (!list.includes(c.subjectId)) list.push(c.subjectId);
  }
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={w.title} subtitle={w.subtitle} />
      <Card title={w.newDoc}>
        {aiEnabled() ? (
          <WorkshopForm
            action={createResource.bind(null, lang)}
            levels={levels.map((l) => ({ id: l.id, label: pickName(l, lang) }))}
            subjects={subjects.map((s) => ({ id: s.id, label: pickName(s, lang) }))}
            subjectsByLevel={subjectsByLevel}
            labels={{
              form: { submit: w.generate, pending: w.generating, errors: dict.formErrors as Record<string, string> },
              kind: w.kind,
              kinds: w.kinds,
              level: w.level,
              subject: w.subject,
              topic: w.topic,
              topicHint: w.topicHint,
              term: w.term,
              duration: w.duration,
              count: w.count,
              difficulty: w.difficulty,
              difficulties: w.difficulties,
              instructions: w.instructions,
              instructionsHint: w.instructionsHint,
              minutes: w.minutes,
              waitNote: w.waitNote,
            }}
          />
        ) : (
          <p className="rounded-xl bg-gold-50 p-3 text-sm text-gold-900 ring-1 ring-gold-200">{w.disabled}</p>
        )}
      </Card>

      <Card title={isAdmin ? w.schoolDocs : w.myDocs}>
        {resources.length === 0 ? (
          <p className="text-sm text-slate-500">{w.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resources.map((r) => (
              <li key={r.id}>
                <Link href={`/${lang}/atelier/${r.id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-gold-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-900">
                    <FileText size={18} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold" dir="auto">{r.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {w.kinds[r.kind].title} · {pickName(r.gradeLevel, lang)} · {pickName(r.subject, lang)} · {fmt.format(r.createdAt)}
                      {isAdmin ? ` · ${personName(r.author, lang)}` : ""}
                    </span>
                  </span>
                  <ChevronRight size={16} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

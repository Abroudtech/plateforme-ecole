import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { aiEnabled } from "@/lib/ai/generate";
import { OFFICIAL_SOURCES, PROGRAMME_LEVELS, lessonTitle, programmeSubjectFor, programmeSubjects, subjectProgramme } from "@/lib/curriculum";
import { SUBJECTS } from "@/lib/setup/tunisia";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { Tabs } from "@/components/tabs";

/**
 * Programme officiel du primaire, par niveau, matière, domaine et leçon.
 * Chaque leçon ouvre l'atelier déjà rempli pour préparer la fiche, des exercices ou un examen.
 */
export default async function ProgrammePage({ params, searchParams }: PageProps<"/[lang]/atelier/programme">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "ai.use");
  const w = dict.workshop;
  const p = dict.programme;
  const schoolId = ctx.school.id;

  const scope = await scopeOf(ctx);
  const [levels, subjects, classes] = await Promise.all([
    db.gradeLevel.findMany({ where: { schoolId, cycle: "PRIMARY", code: { in: [...PROGRAMME_LEVELS] } }, orderBy: { rank: "asc" } }),
    db.subject.findMany({ where: { schoolId } }),
    db.classGroup.findMany({
      where: { schoolId, academicYear: { isCurrent: true }, ...(scope ? { id: { in: scope } } : {}) },
      select: { gradeLevel: { select: { code: true } } },
    }),
  ]);

  // Niveau affiché : celui demandé, sinon le premier niveau enseigné, sinon la 1re année.
  const taught = classes.map((c) => c.gradeLevel.code).filter((c) => (PROGRAMME_LEVELS as readonly string[]).includes(c));
  const levelCode = PROGRAMME_LEVELS.find((c) => c === one(sp.niveau)) ?? PROGRAMME_LEVELS.find((c) => taught.includes(c)) ?? "P1";
  const termFilter = ["1", "2", "3"].includes(one(sp.trimestre) ?? "") ? Number(one(sp.trimestre)) : null;
  const level = levels.find((l) => l.code === levelCode);
  const ai = aiEnabled();
  const base = `/${lang}/atelier/programme`;
  const href = (q: { niveau?: string; trimestre?: string | null }) => {
    const niveau = q.niveau ?? levelCode;
    const trimestre = q.trimestre === undefined ? (termFilter ? String(termFilter) : null) : q.trimestre;
    return `${base}?niveau=${niveau}${trimestre ? `&trimestre=${trimestre}` : ""}`;
  };

  const levelName = (code: string) => {
    const l = levels.find((x) => x.code === code);
    return l ? pickName(l, lang) : code;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={p.title} subtitle={p.subtitle} back={{ href: `/${lang}/atelier`, label: w.title }} />

      <div>
        <Tabs items={PROGRAMME_LEVELS.map((c) => ({ key: c, label: levelName(c), href: href({ niveau: c }) }))} active={levelCode} />
        <Tabs
          items={[
            { key: "all", label: p.allTerms, href: href({ trimestre: null }) },
            ...["1", "2", "3"].map((t) => ({ key: t, label: `${p.term} ${t}`, href: href({ trimestre: t }) })),
          ]}
          active={termFilter ? String(termFilter) : "all"}
        />
      </div>

      {programmeSubjects(levelCode).map((code) => {
        const view = subjectProgramme(levelCode, code)!;
        const schoolSubject = subjects.find((s) => programmeSubjectFor(s) === code);
        const ref = SUBJECTS.find((s) => s.code === code)!;
        const title = schoolSubject ? pickName(schoolSubject, lang) : pickName(ref, lang);
        const canPrepare = ai && level && schoolSubject;
        const domains = view.domains
          .map((dm) => ({ ...dm, lessons: dm.lessons.filter((l) => !termFilter || l.term === termFilter) }))
          .filter((dm) => dm.lessons.length > 0);
        if (domains.length === 0) return null;
        return (
          <Card key={code} title={title}>
            <p className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900" dir="auto">
              <span className="font-semibold">{p.competence} : </span>
              {lessonTitle(view.competence, lang)}
            </p>
            <div className="flex flex-col gap-4">
              {domains.map((dm) => (
                <div key={dm.fr}>
                  <h3 className="mb-1.5 text-sm font-semibold tracking-wide text-slate-500 uppercase" dir="auto">{lessonTitle(dm, lang)}</h3>
                  <ul className="flex flex-col divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                    {dm.lessons.map((lesson) => {
                      const q = canPrepare ? `niveau=${level.id}&matiere=${schoolSubject.id}&lecon=${lesson.id}` : "";
                      return (
                        <li key={lesson.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                          <span className="grid h-7 w-9 shrink-0 place-items-center rounded-lg bg-gold-50 text-xs font-bold text-gold-900 ring-1 ring-gold-200" title={`${p.term} ${lesson.term}`}>
                            T{lesson.term}
                          </span>
                          <span className="min-w-0 flex-1 basis-48" dir="auto">
                            <span className="block font-medium">{lessonTitle(lesson, lang)}</span>
                            {lang === "fr" && lesson.ar !== lesson.fr && <span className="block text-left text-xs text-slate-500" dir="rtl" lang="ar">{lesson.ar}</span>}
                          </span>
                          {canPrepare && (
                            <span className="flex flex-wrap gap-1.5">
                              <Link href={`/${lang}/atelier?type=LESSON&${q}`} className="rounded-lg bg-blue-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
                                {p.prepareLesson}
                              </Link>
                              <Link href={`/${lang}/atelier?type=EXERCISES&${q}`} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-900 ring-1 ring-slate-300 hover:ring-gold-400">
                                {w.kinds.EXERCISES.title}
                              </Link>
                              <Link href={`/${lang}/atelier?type=EXAM&${q}`} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-900 ring-1 ring-slate-300 hover:ring-gold-400">
                                {w.kinds.EXAM.title}
                              </Link>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Card title={p.sourcesTitle}>
        <p className="text-sm text-slate-600">{p.sourcesText}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {OFFICIAL_SOURCES.map((s) => (
            <li key={s.key}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline">
                <ExternalLink size={15} aria-hidden /> {p.sources[s.key]}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-gold-50 p-3 text-xs text-gold-900 ring-1 ring-gold-200">{p.manualsNote}</p>
      </Card>
    </div>
  );
}

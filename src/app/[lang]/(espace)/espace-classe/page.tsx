import Link from "next/link";
import { BarChart3, ChevronRight, Trophy, Zap } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { aiEnabled } from "@/lib/ai/generate";
import { leaderboard, managedClasses, studentOf, weekStart } from "@/lib/data/class-space";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { createChallenge, deleteChallenge, suggestQuestions } from "./actions";
import { ChallengeForm } from "./challenge-form";
import { Leaderboard } from "./leaderboard";
import { Wall } from "./wall";
import { ActionForm } from "@/components/action-form";
import { formLabels } from "@/i18n/form-labels";

const TABS = ["mur", "defis", "classement"] as const;

/**
 * Espace de classe : mur supervisé, défis et classement.
 * L'enseignant anime ses classes ; l'élève voit uniquement la sienne.
 */
export default async function ClassSpacePage({ params, searchParams }: PageProps<"/[lang]/espace-classe">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classSpace.read");
  const cs = dict.classSpace;
  const manage = can(ctx.roles, "classSpace.manage");

  // Classe affichée.
  let classes: { id: string; name: string; nameAr: string | null; gradeLevel: { nameFr: string; nameAr: string } }[] = [];
  if (manage) classes = await managedClasses(ctx);
  else {
    const student = await studentOf(ctx.school.id, ctx.user.id);
    if (student?.classGroup) classes = [student.classGroup];
  }
  if (classes.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={dict.nav.classSpace} />
        <p className="rounded-2xl bg-gold-50 p-4 text-gold-900 ring-1 ring-gold-200">{manage ? cs.noClasses : cs.noClass}</p>
      </div>
    );
  }
  const current = classes.find((c) => c.id === sp.classe) ?? classes[0];
  const tab = TABS.find((x) => x === sp.onglet) ?? "mur";
  const href = (k: string, classId = current.id) => `/${lang}/espace-classe?classe=${classId}&onglet=${k}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`${dict.nav.classSpace} · ${className(current, lang)}`} subtitle={manage ? cs.subtitleTeacher : cs.subtitleStudent} />
      {manage && classes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={href(tab, c.id)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${c.id === current.id ? "bg-gold-500 text-blue-950 ring-gold-500" : "bg-white ring-slate-200"}`}
            >
              {className(c, lang)}
            </Link>
          ))}
        </div>
      )}
      <Tabs active={tab} items={TABS.map((k) => ({ key: k, href: href(k), label: cs.tabs[k] }))} />

      {tab === "mur" && <Wall schoolId={ctx.school.id} classId={current.id} userId={ctx.user.id} manage={manage} lang={lang} dict={dict} />}
      {tab === "defis" && (manage ? <TeacherChallenges classId={current.id} /> : <StudentChallengesLink />)}
      {tab === "classement" && <Rankings classId={current.id} />}
    </div>
  );

  async function TeacherChallenges({ classId }: { classId: string }) {
    const cls = await db.classGroup.findFirstOrThrow({ where: { id: classId }, select: { gradeLevelId: true, trackId: true } });
    const [challenges, subjects, enrolled] = await Promise.all([
      db.challenge.findMany({
        where: { schoolId: ctx.school.id, classGroupId: classId },
        include: { subject: true, attempts: { select: { score: true, maxScore: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.curriculumSubject.findMany({
        where: { schoolId: ctx.school.id, gradeLevelId: cls.gradeLevelId },
        include: { subject: true },
        orderBy: { coefficient: "desc" },
      }),
      db.enrollment.count({ where: { classGroupId: classId, status: "ACTIVE" } }),
    ]);
    const subjectOptions = [...new Map(subjects.map((s) => [s.subjectId, { id: s.subjectId, label: pickName(s.subject, lang) }])).values()];
    return (
      <div className="flex flex-col gap-4">
        <Card title={cs.newChallenge}>
          <ChallengeForm
            action={createChallenge.bind(null, lang, classId)}
            suggest={async (input) => {
              "use server";
              return suggestQuestions(lang, { ...input, classId });
            }}
            subjects={subjectOptions}
            aiOn={can(ctx.roles, "ai.use") && aiEnabled()}
            labels={{
              form: { ...formLabels(dict, cs.createChallenge), errors: dict.formErrors as Record<string, string> },
              title: cs.challengeTitle,
              subject: dict.workshop.subject,
              noSubject: cs.noSubject,
              closesAt: cs.closesAt,
              question: cs.question,
              choice: cs.choice,
              correct: cs.correctHint,
              addQuestion: cs.addQuestion,
              removeQuestion: cs.removeQuestion,
              ai: cs.ai,
              aiTopic: dict.workshop.topic,
              aiCount: cs.aiCount,
              aiGenerate: cs.aiGenerate,
              aiGenerating: cs.aiGenerating,
              aiReview: cs.aiReview,
            }}
          />
        </Card>
        <Card title={cs.challenges}>
          {challenges.length === 0 ? (
            <p className="text-sm text-slate-500">{cs.noChallenges}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {challenges.map((c) => {
                const avg = c.attempts.length ? c.attempts.reduce((s, a) => s + a.score / a.maxScore, 0) / c.attempts.length : null;
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                    <Link href={`/${lang}/espace-classe/defis/${c.id}`} className="flex min-w-[min(100%,14rem)] flex-1 items-center gap-3">
                      <Trophy size={18} className="shrink-0 text-gold-600" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold" dir="auto">{c.title}</span>
                        <span className="block text-xs text-slate-500">
                          {c.subject ? `${pickName(c.subject, lang)} · ` : ""}
                          {t(cs.answered, { count: c.attempts.length, total: enrolled })}
                          {avg != null ? ` · ${t(cs.average, { pct: Math.round(avg * 100) })}` : ""}
                        </span>
                      </span>
                      <ChevronRight size={16} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
                    </Link>
                    <Link
                      href={`/${lang}/espace-classe/defis/${c.id}#direct`}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-950 px-2.5 py-1.5 text-xs font-bold text-gold-300 hover:bg-blue-900"
                    >
                      <Zap size={13} aria-hidden /> {dict.live.launch}
                    </Link>
                    <ActionForm
                      action={deleteChallenge.bind(null, lang, c.id)}
                      labels={{ ...formLabels(dict, dict.common.remove), saved: undefined }}
                      variant="danger"
                      confirm={`${dict.common.remove} ?`}
                      className="contents"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  function StudentChallengesLink() {
    return (
      <Link href={`/${lang}/defis`} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-semibold shadow-card ring-1 ring-slate-200/80">
        <Trophy size={20} className="text-gold-600" aria-hidden /> {cs.goChallenges}
        <ChevronRight size={16} className="ms-auto text-slate-400 rtl:rotate-180" aria-hidden />
      </Link>
    );
  }

  async function Rankings({ classId }: { classId: string }) {
    const [week, year] = await Promise.all([leaderboard(ctx.school.id, classId, weekStart()), leaderboard(ctx.school.id, classId)]);
    const me = manage ? null : (await studentOf(ctx.school.id, ctx.user.id))?.id ?? null;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Leaderboard title={cs.thisWeek} rows={week} me={me} lang={lang} dict={dict} />
        <Leaderboard title={cs.thisYear} rows={year} me={me} lang={lang} dict={dict} />
        <p className="flex items-center gap-2 text-xs text-slate-500 md:col-span-2">
          <BarChart3 size={14} aria-hidden /> {cs.pointsRule}
        </p>
      </div>
    );
  }
}

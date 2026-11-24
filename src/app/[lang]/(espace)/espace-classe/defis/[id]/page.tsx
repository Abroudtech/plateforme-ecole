import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { hasClassAccess } from "@/lib/auth/scope";
import { challengeQuestionsSchema } from "@/lib/challenges";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { LiveLaunch } from "@/components/live-launch";

/** Résultats d'un défi pour l'enseignant : qui a répondu, et les questions difficiles. */
export default async function ChallengeResultsPage({ params }: PageProps<"/[lang]/espace-classe/defis/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "classSpace.manage");
  const cs = dict.classSpace;
  const c = await db.challenge.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: { classGroup: true, attempts: { include: { student: true } } },
  });
  if (!c || !(await hasClassAccess(ctx, c.classGroupId))) notFound();
  const questions = challengeQuestionsSchema.parse(c.questions);
  const enrolled = await db.enrollment.findMany({
    where: { classGroupId: c.classGroupId, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { lastName: "asc" } },
  });
  const byStudent = new Map(c.attempts.map((a) => [a.studentId, a]));
  const success = questions.map((q, i) => {
    const n = c.attempts.filter((a) => (a.answers as (number | null)[])[i] === q.answer).length;
    return c.attempts.length ? n / c.attempts.length : null;
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={c.title}
        subtitle={`${className(c.classGroup, lang)} · ${t(cs.answered, { count: c.attempts.length, total: enrolled.length })}`}
        back={{ href: `/${lang}/espace-classe?classe=${c.classGroupId}&onglet=defis`, label: dict.nav.classSpace }}
      />
      <LiveLaunch lang={lang} challengeId={c.id} dict={dict} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={cs.results}>
          <ul className="flex flex-col gap-1.5">
            {enrolled.map((e) => {
              const a = byStudent.get(e.studentId);
              return (
                <li key={e.studentId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium">{personName(e.student, lang)}</span>
                  {a ? (
                    <span className={`font-bold tabular-nums ${a.score / a.maxScore >= 0.5 ? "text-emerald-700" : "text-red-700"}`}>
                      <bdi dir="ltr">{a.score} / {a.maxScore}</bdi>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{cs.notAnswered}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title={cs.questions}>
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold" dir="auto">{i + 1}. {q.q}</p>
                <p className="mt-1 text-emerald-800" dir="auto">✓ {q.choices[q.answer]}</p>
                {success[i] != null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-900" style={{ width: `${Math.round(success[i]! * 100)}%` }} />
                    </div>
                    <span className="w-10 text-end text-xs tabular-nums"><bdi dir="ltr">{Math.round(success[i]! * 100)}%</bdi></span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

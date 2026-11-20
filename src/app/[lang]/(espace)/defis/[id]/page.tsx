import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { challengeQuestionsSchema } from "@/lib/challenges";
import { studentOf } from "@/lib/data/class-space";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { submitChallenge } from "../../espace-classe/actions";
import { QuizPlayer } from "@/components/quiz-player";

/** L'élève répond au défi (une seule fois). Les bonnes réponses ne sont envoyées qu'après. */
export default async function PlayChallengePage({
  params,
}: PageProps<"/[lang]/defis/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "student.space");
  const student = await studentOf(ctx.school.id, ctx.user.id);
  const c = await db.challenge.findFirst({
    where: {
      id,
      schoolId: ctx.school.id,
      classGroupId: student?.classGroup?.id ?? "__aucune__",
    },
    include: { attempts: { where: { studentId: student?.id ?? "__aucun__" } } },
  });
  if (!c) notFound();
  const questions = challengeQuestionsSchema.parse(c.questions);
  const cs = dict.classSpace;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={c.title}
        back={{ href: `/${lang}/defis`, label: dict.nav.challenges }}
      />
      {c.attempts.length > 0 && (
        <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {cs.alreadyDone}
        </p>
      )}
      <QuizPlayer
        done={
          c.attempts[0]
            ? {
                answers: c.attempts[0].answers as (number | null)[],
                score: c.attempts[0].score,
                correct: questions.map((q) => q.answer),
              }
            : undefined
        }
        // Questions sans la bonne réponse : la correction vient du serveur.
        questions={questions.map((q) => ({ prompt: q.q, choices: q.choices }))}
        submit={async (answers) => {
          "use server";
          return submitChallenge(lang, c.id, answers);
        }}
        labels={{
          question: cs.question,
          next: cs.next,
          finish: cs.finish,
          sending: cs.sending,
          result: cs.result,
          back: dict.nav.challenges,
          backHref: `/${lang}/defis`,
          errors: dict.formErrors as Record<string, string>,
        }}
      />
    </div>
  );
}

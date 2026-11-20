import Link from "next/link";
import { ChevronRight, CircleCheck, Trophy } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { POINTS_PER_CHALLENGE_ANSWER } from "@/lib/challenges";
import { studentOf } from "@/lib/data/class-space";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";

/** Défis de la classe de l'élève : à faire, puis terminés avec le score. */
export default async function ChallengesPage({ params }: PageProps<"/[lang]/defis">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "student.space");
  const cs = dict.classSpace;
  const student = await studentOf(ctx.school.id, ctx.user.id);
  const challenges = student?.classGroup
    ? await db.challenge.findMany({
        where: { schoolId: ctx.school.id, classGroupId: student.classGroup.id },
        include: { subject: true, attempts: { where: { studentId: student.id } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const now = new Date();
  const todo = challenges.filter((c) => c.attempts.length === 0 && (!c.closesAt || c.closesAt > now));
  const done = challenges.filter((c) => c.attempts.length > 0);
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={dict.nav.challenges} subtitle={cs.challengesSubtitle} />
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-blue-900">{cs.todo}</h2>
        {todo.length === 0 ? (
          <p className="text-sm text-slate-500">{cs.nothingTodo}</p>
        ) : (
          todo.map((c) => (
            <Link key={c.id} href={`/${lang}/defis/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-gold-300 hover:ring-gold-500">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-700"><Trophy size={22} aria-hidden /></span>
              <span className="min-w-0">
                <span className="block truncate font-bold" dir="auto">{c.title}</span>
                <span className="block text-xs text-slate-500">
                  {c.subject ? `${pickName(c.subject, lang)} · ` : ""}
                  {(c.questions as unknown[]).length} {cs.questionsShort} · +{(c.questions as unknown[]).length * POINTS_PER_CHALLENGE_ANSWER} {cs.pts}
                  {c.closesAt ? ` · ${cs.until} ${fmt.format(c.closesAt)}` : ""}
                </span>
              </span>
              <ChevronRight size={18} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
            </Link>
          ))
        )}
      </section>
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-blue-900">{cs.done}</h2>
          {done.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80">
              <CircleCheck size={20} className="shrink-0 text-emerald-600" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{c.title}</span>
              <span className="text-sm font-bold tabular-nums"><bdi dir="ltr">{c.attempts[0].score} / {c.attempts[0].maxScore}</bdi></span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { Newspaper, NotebookPen, Puzzle, Trophy } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className } from "@/i18n/localized";
import type { AppContext } from "@/lib/auth/context";
import { leaderboard, studentOf, weekStart } from "@/lib/data/class-space";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { Leaderboard } from "../espace-classe/leaderboard";
import { IconBadge, Notice } from "./dashboard-ui";
import { UpcomingPanel } from "./upcoming-panel";
import { LiveBanner } from "@/components/live-banner";

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

/** Accueil de l'élève : ses points, les défis à faire, les jeux et sa classe. */
export async function StudentDashboard({ ctx, lang, dict }: Props) {
  const cs = dict.classSpace;
  const student = await studentOf(ctx.school.id, ctx.user.id);
  if (!student?.classGroup) return <Notice text={cs.noClass} />;
  const classId = student.classGroup.id;
  const now = new Date();
  const [week, year, todo, lastPost, homework] = await Promise.all([
    leaderboard(ctx.school.id, classId, weekStart()),
    leaderboard(ctx.school.id, classId),
    db.challenge.count({
      where: { schoolId: ctx.school.id, classGroupId: classId, attempts: { none: { studentId: student.id } }, OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
    }),
    db.classPost.findFirst({ where: { classGroupId: classId, status: "PUBLISHED" }, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }] }),
    db.homework.count({ where: { schoolId: ctx.school.id, classGroupId: classId, task: { not: null }, dueDate: { gte: parseISODate(todayISO())! }, done: { none: { studentId: student.id } } } }),
  ]);
  const me = year.find((r) => r.student.id === student.id);

  return (
    <>
      <section className="relative -mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 md:-mt-10 md:px-4">
        {[
          { href: `/${lang}/devoirs`, icon: NotebookPen, tone: "blue" as const, label: dict.homework.myHomework, extra: homework ? t(cs.todoCount, { count: homework }) : cs.nothingTodoShort },
          { href: `/${lang}/defis`, icon: Trophy, tone: "gold" as const, label: dict.nav.challenges, extra: todo ? t(cs.todoCount, { count: todo }) : cs.nothingTodoShort },
          { href: `/${lang}/jeux`, icon: Puzzle, tone: "green" as const, label: dict.nav.games, extra: cs.playToEarn },
          { href: `/${lang}/espace-classe`, icon: Newspaper, tone: "blue" as const, label: className(student.classGroup, lang), extra: dict.nav.classSpace },
        ].map((c) => (
          <Link key={c.href} href={c.href} className={`flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 hover:ring-gold-400 ${c.icon === Trophy && todo ? "ring-gold-400" : "ring-slate-200/80"}`}>
            <IconBadge icon={c.icon} tone={c.tone} />
            <span className="text-sm font-semibold leading-tight">{c.label}</span>
            <span className="text-xs text-slate-500">{c.extra}</span>
          </Link>
        ))}
      </section>

      <LiveBanner schoolId={ctx.school.id} classId={classId} lang={lang} dict={dict} />

      <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold-500 text-2xl font-bold text-blue-950">
          <bdi dir="ltr">{me?.points ?? 0}</bdi>
        </span>
        <div>
          <p className="font-bold text-blue-900">{cs.myPoints}</p>
          <p className="text-sm text-slate-600">{me && me.points > 0 ? t(cs.myRank, { rank: me.rank, total: year.length }) : cs.startPlaying}</p>
        </div>
      </section>

      <UpcomingPanel ctx={ctx} lang={lang} dict={dict} />

      {lastPost && (
        <Link href={`/${lang}/espace-classe`} className="block rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
          <p className="text-xs font-semibold text-blue-800">{cs.lastPost}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line" dir="auto">{lastPost.body}</p>
        </Link>
      )}

      <Leaderboard title={cs.thisWeek} rows={week} me={student.id} lang={lang} dict={dict} limit={5} />
    </>
  );
}

import Link from "next/link";
import { CalendarHeart, ChevronRight, Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { className, pickName } from "@/i18n/localized";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { addDays } from "@/lib/calendar";
import { agendaScope, listEvents, listExams } from "@/lib/data/calendar";
import { parseISODate, todayISO } from "@/lib/dates";
import { formatTime } from "@/lib/timetable";
import { DateBadge, whenLabel } from "../examens/exam-ui";
import { Panel } from "./dashboard-ui";

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

/**
 * « Prochains examens » sur l'accueil (enseignant, parent, élève) : les examens
 * des 3 prochaines semaines et les dates de l'école, avec un lien vers le calendrier.
 */
export async function UpcomingPanel({ ctx, lang, dict }: Props) {
  const today = todayISO();
  const from = parseISODate(today)!;
  const to = parseISODate(addDays(today, 21))!;
  const scope = await agendaScope(ctx, lang);
  const [exams, events] = await Promise.all([listExams(ctx.school.id, scope.classIds, from, to), listEvents(ctx.school.id, scope, from, to)]);
  const canPrepare = can(ctx.roles, "exams.write");
  if (exams.length === 0 && events.length === 0 && !canPrepare) return null;
  const multiChild = new Set([...scope.childByClass.values()].flat()).size > 1;
  const staff = ctx.roles.includes("TEACHER") || ctx.roles.includes("ADMIN");

  return (
    <Panel title={dict.exams.next}>
      {exams.length === 0 && events.length === 0 ? (
        <p className="text-sm text-slate-500">{dict.exams.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[
            ...events.slice(0, 3).map((ev) => ({ date: ev.date, key: ev.id, node: (
              <li key={ev.id} className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5">
                <DateBadge date={ev.date} lang={lang} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-800"><CalendarHeart size={12} aria-hidden /> {dict.calendar.eventKinds[ev.kind]}</span>
                  <span className="block truncate font-semibold" dir="auto">{ev.title}</span>
                </span>
              </li>
            ) })),
            ...exams.slice(0, 5).map((x) => {
              const when = whenLabel(x.date, today, dict);
              const kids = scope.childByClass.get(x.classGroupId);
              const tag = kids?.length ? (multiChild ? kids.join(", ") : null) : staff ? className(x.classGroup, lang) : null;
              const inner = (
                <>
                  <DateBadge date={x.date} lang={lang} tone="gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {pickName(x.subject, lang)} · {dict.grades.kindsShort[x.kind]}
                      {tag ? <span className="font-normal text-slate-500"> · {tag}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-slate-500" dir="auto">
                      {when ? `${when}` : ""}
                      {x.startMinute != null && <> · <bdi dir="ltr">{formatTime(x.startMinute)}</bdi></>}
                      {x.revision ? ` · ${x.revision}` : ""}
                    </span>
                  </span>
                </>
              );
              return { date: x.date, key: x.id, node: (
                <li key={x.id}>
                  {canPrepare ? (
                    <Link href={`/${lang}/examens/${x.id}`} className="flex items-center gap-3 rounded-xl bg-gold-50 px-3 py-2.5 hover:ring-1 hover:ring-gold-400">{inner}</Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-gold-50 px-3 py-2.5">{inner}</div>
                  )}
                </li>
              ) };
            }),
          ]
            // Les dates de l'école et les examens, dans l'ordre chronologique.
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 6)
            .map((x) => x.node)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canPrepare && (
          <Link href={`/${lang}/examens`} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <Plus size={15} aria-hidden /> {dict.exams.prepare}
          </Link>
        )}
        <Link href={`/${lang}/calendrier`} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          {dict.nav.calendar} <ChevronRight size={15} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}

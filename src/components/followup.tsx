import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { className, personName } from "@/i18n/localized";
import type { FollowupReason, studentsToFollow } from "@/lib/data/followup";
import { formatMoney } from "@/lib/payments";

const TONE: Record<FollowupReason["kind"], string> = {
  low: "bg-red-50 text-red-800 ring-red-200",
  drop: "bg-amber-50 text-amber-800 ring-amber-200",
  absent: "bg-orange-50 text-orange-800 ring-orange-200",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-300",
};

export function ReasonChip({ reason, lang, dict }: { reason: FollowupReason; lang: Locale; dict: Dictionary }) {
  const f = dict.followup;
  const n = (x: number) => x.toFixed(2).replace(".", lang === "ar" ? "٫" : ",");
  const text =
    reason.kind === "low"
      ? t(f.low, { average: n(reason.average) })
      : reason.kind === "drop"
        ? t(f.drop, { from: n(reason.from), to: n(reason.to) })
        : reason.kind === "absent"
          ? t(f.absent, { count: reason.count })
          : t(f.unpaid, { amount: formatMoney(reason.amount, lang) });
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TONE[reason.kind]}`}>{text}</span>;
}

export function FollowupList({ rows, lang, dict }: { rows: Awaited<ReturnType<typeof studentsToFollow>>; lang: Locale; dict: Dictionary }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.student.id}>
          <Link href={`/${lang}/eleves/${r.student.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-gold-50">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{personName(r.student, lang)}</span>
              <span className="text-slate-500"> · {className(r.cls, lang)}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {r.reasons.map((reason, i) => (
                <ReasonChip key={i} reason={reason} lang={lang} dict={dict} />
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Row = {
  rank: number;
  points: number;
  student: { id: string; firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null };
};

/** Prénom et initiale du nom : les élèves ne voient pas plus des autres. */
export function shortName(s: Row["student"], lang: Locale) {
  const first = lang === "ar" && s.firstNameAr ? s.firstNameAr : s.firstName;
  const last = lang === "ar" && s.lastNameAr ? s.lastNameAr : s.lastName;
  return `${first} ${last.slice(0, 1)}.`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Classement de la classe : les 10 premiers, et l'élève connecté s'il est plus loin. */
export function Leaderboard({ title, rows, me, lang, dict, limit = 10 }: { title: string; rows: Row[]; me: string | null; lang: Locale; dict: Dictionary; limit?: number }) {
  const cs = dict.classSpace;
  const top = rows.slice(0, limit);
  const mine = me ? rows.find((r) => r.student.id === me) : undefined;
  const shown = mine && !top.includes(mine) ? [...top, mine] : top;
  const empty = rows.every((r) => r.points === 0);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
      <h2 className="mb-3 text-base font-bold text-blue-900">{title}</h2>
      {empty ? (
        <p className="text-sm text-slate-500">{cs.noPoints}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {shown.map((r) => (
            <li
              key={r.student.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.student.id === me ? "bg-gold-100 ring-1 ring-gold-400" : r.rank <= 3 ? "bg-blue-50" : "bg-slate-50"}`}
            >
              <span className="w-7 text-center text-sm font-bold tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{shortName(r.student, lang)}</span>
              <span className="text-sm font-bold tabular-nums text-blue-900">
                <bdi dir="ltr">{r.points}</bdi> {cs.pts}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

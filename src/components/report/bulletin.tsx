import type { Dictionary } from "@/i18n/dictionaries";
import { personName } from "@/i18n/localized";
import { round2 } from "@/lib/grades/compute";
import type { computeClassReport } from "@/lib/data/grades";

type Report = NonNullable<Awaited<ReturnType<typeof computeClassReport>>>;

/** Affiche un nombre comme "12,50" (fr) ou "12.50" ; "—" si vide. */
function fmt(n: number | null | undefined) {
  return n == null ? "—" : round2(n).toFixed(2);
}

/** Libellé bilingue : français au-dessus, arabe en dessous. */
function Bi({ fr, ar, className = "" }: { fr: string; ar: string; className?: string }) {
  return (
    <span className={`flex flex-col leading-tight ${className}`}>
      <span lang="fr" dir="ltr">{fr}</span>
      <span lang="ar" dir="rtl" className="text-slate-600">{ar}</span>
    </span>
  );
}

/**
 * Bulletin de notes bilingue (français + arabe sur le même document),
 * lisible sur téléphone et prêt à imprimer.
 */
export function Bulletin({
  report,
  studentId,
  term,
  school,
  fr,
  ar,
}: {
  report: Report;
  studentId: string;
  term: { nameFr: string; nameAr: string };
  school: { nameFr: string; nameAr: string; city: string | null };
  fr: Dictionary;
  ar: Dictionary;
}) {
  const student = report.students.find((s) => s.id === studentId)!;
  const general = report.generals.get(studentId) ?? null;
  const rank = report.ranks.get(studentId) ?? null;
  const ranked = [...report.ranks.values()].filter((r) => r !== null).length;
  const comment = report.comments.get(studentId);
  const cls = report.cls;
  const L = (k: keyof Dictionary["reportCards"]) => ({ fr: fr.reportCards[k], ar: ar.reportCards[k] });

  return (
    <article className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:ring-0">
      {/* En-tête : école en français à gauche, en arabe à droite */}
      <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3" dir="ltr">
        <div lang="fr">
          <p className="text-base font-bold">{school.nameFr}</p>
          {school.city && <p className="text-slate-600">{school.city}</p>}
        </div>
        <div lang="ar" dir="rtl" className="text-right">
          <p className="text-base font-bold">{school.nameAr}</p>
        </div>
      </header>

      <div className="my-4 text-center" dir="ltr">
        <h1 className="text-xl font-bold">
          {fr.reportCards.bulletin} <span className="mx-1 text-slate-400">·</span> <span lang="ar">{ar.reportCards.bulletin}</span>
        </h1>
        <p className="text-slate-700">
          <bdi>{term.nameFr}</bdi> <span className="mx-1 text-slate-400">·</span> <bdi lang="ar">{term.nameAr}</bdi>
        </p>
        <p className="text-slate-700">
          <bdi>{fr.reportCards.year}</bdi> <bdi dir="ltr" className="font-semibold">{cls.academicYear.label}</bdi>{" "}
          <bdi lang="ar">{ar.reportCards.year}</bdi>
        </p>
      </div>

      {/* Identité de l'élève */}
      <dl className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3" dir="ltr">
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("student")} /></dt>
          <dd className="font-semibold">
            {personName(student, "fr")}
            {student.firstNameAr && student.lastNameAr && (
              <span lang="ar" dir="rtl" className="block">{personName(student, "ar")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("class")} /></dt>
          <dd className="font-semibold">
            {cls.name}
            <span className="block font-normal text-slate-600">
              {cls.gradeLevel.nameFr} <span lang="ar" dir="rtl">· {cls.gradeLevel.nameAr}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("number")} /></dt>
          <dd className="font-semibold">{student.studentNumber}</dd>
        </div>
      </dl>

      {/* Tableau des matières */}
      <div className="overflow-x-auto" dir="ltr">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-slate-300 align-bottom text-xs text-slate-500">
              <th className="py-2 pe-2 font-medium"><Bi {...L("subject")} /></th>
              <th className="px-2 py-2 text-center font-medium"><Bi {...L("coefficient")} /></th>
              <th className="px-2 py-2 text-center font-medium"><Bi {...L("average")} /></th>
              <th className="py-2 ps-2 text-center font-medium"><Bi {...L("classAverage")} /></th>
            </tr>
          </thead>
          <tbody>
            {report.subjects.map((row) => (
              <tr key={row.subject.id} className="border-b border-slate-100">
                <td className="py-2 pe-2">
                  <Bi fr={row.subject.nameFr} ar={row.subject.nameAr} />
                </td>
                <td className="px-2 py-2 text-center">{row.coefficient}</td>
                <td className="px-2 py-2 text-center font-semibold">{fmt(row.averages.get(studentId))}</td>
                <td className="py-2 ps-2 text-center text-slate-600">{fmt(row.classStats?.mean)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résultats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" dir="ltr">
        <Result label={L("general")} value={fmt(general)} strong />
        <Result label={L("rank")} value={rank ? `${rank} / ${ranked}` : "—"} />
        <Result label={L("highest")} value={fmt(report.classStats?.max)} />
        <Result label={L("lowest")} value={fmt(report.classStats?.min)} />
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 p-3" dir="ltr">
        <p className="mb-1 text-xs text-slate-500"><Bi {...L("comment")} /></p>
        <p className="min-h-10 whitespace-pre-line" dir="auto">{comment ?? ""}</p>
      </section>

      <footer className="mt-6 flex justify-end" dir="ltr">
        <div className="w-48 border-t border-slate-300 pt-1 text-center text-xs text-slate-500">
          <Bi {...L("signature")} />
        </div>
      </footer>
    </article>
  );
}

function Result({ label, value, strong }: { label: { fr: string; ar: string }; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${strong ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"}`}>
      <p className="text-xs text-slate-500"><Bi {...label} className="items-center" /></p>
      <p className={`mt-1 ${strong ? "text-2xl font-bold text-blue-900" : "text-lg font-semibold"}`}>{value}</p>
    </div>
  );
}

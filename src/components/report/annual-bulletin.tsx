import type { Dictionary } from "@/i18n/dictionaries";
import { personName } from "@/i18n/localized";
import { round2 } from "@/lib/grades/compute";
import { formulaText } from "@/lib/grades/annual";
import { t } from "@/i18n/format";
import type { computeClassAnnual } from "@/lib/data/annual";

type Annual = NonNullable<Awaited<ReturnType<typeof computeClassAnnual>>>;

function fmt(n: number | null | undefined) {
  return n == null ? "—" : round2(n).toFixed(2);
}

function Bi({ fr, ar, className = "" }: { fr: string; ar: string; className?: string }) {
  return (
    <span className={`flex flex-col leading-tight ${className}`}>
      <span lang="fr" dir="ltr">{fr}</span>
      <span lang="ar" dir="rtl" className="text-slate-600">{ar}</span>
    </span>
  );
}

/** Bulletin annuel bilingue : moyenne de chaque trimestre, moyenne annuelle, décision proposée. */
export function AnnualBulletin({
  data,
  studentId,
  school,
  fr,
  ar,
}: {
  data: Annual;
  studentId: string;
  school: { nameFr: string; nameAr: string; city: string | null };
  fr: Dictionary;
  ar: Dictionary;
}) {
  const student = data.students.find((s) => s.id === studentId)!;
  const annual = data.annual.get(studentId)!;
  const rank = data.ranks.get(studentId) ?? null;
  const ranked = [...data.ranks.values()].filter((r) => r !== null).length;
  const decision = data.decisions.get(studentId)!;
  const termAvgs = data.termGenerals.get(studentId)!;
  const cls = data.cls;
  const L = (k: keyof Dictionary["reportCards"]) => ({ fr: fr.reportCards[k] as string, ar: ar.reportCards[k] as string });
  const formula = formulaText(data.rule.termWeights);

  return (
    <article className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:ring-0">
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
          {fr.reportCards.annualTitle} <span className="mx-1 text-slate-400">·</span> <span lang="ar">{ar.reportCards.annualTitle}</span>
        </h1>
        <p className="text-slate-700">
          <bdi>{fr.reportCards.year}</bdi> <bdi dir="ltr" className="font-semibold">{cls.academicYear.label}</bdi>{" "}
          <bdi lang="ar">{ar.reportCards.year}</bdi>
        </p>
      </div>

      <dl className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3" dir="ltr">
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("student")} /></dt>
          <dd className="font-semibold">
            {personName(student, "fr")}
            {student.firstNameAr && student.lastNameAr && <span lang="ar" dir="rtl" className="block">{personName(student, "ar")}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("class")} /></dt>
          <dd className="font-semibold">{cls.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500"><Bi {...L("number")} /></dt>
          <dd className="font-semibold">{student.studentNumber}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto" dir="ltr">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-slate-300 align-bottom text-xs text-slate-500">
              <th className="py-2 pe-2 font-medium"><Bi {...L("subject")} /></th>
              <th className="px-2 py-2 text-center font-medium"><Bi {...L("coefficient")} /></th>
              {data.terms.map((term, i) => (
                <th key={term.id} title={term.nameFr} className="px-1 py-2 text-center font-medium">
                  <Bi fr={`T${i + 1}`} ar={`ث${i + 1}`} className="items-center" />
                </th>
              ))}
              <th className="py-2 ps-2 text-center font-medium"><Bi fr="Annuelle" ar="السنوي" className="items-center" /></th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((row) => {
              const v = row.byStudent.get(studentId)!;
              return (
                <tr key={row.subject.id} className="border-b border-slate-100">
                  <td className="py-2 pe-2"><Bi fr={row.subject.nameFr} ar={row.subject.nameAr} /></td>
                  <td className="px-2 py-2 text-center">{row.coefficient}</td>
                  {v.perTerm.map((a, i) => (
                    <td key={i} className="px-1 py-2 text-center text-slate-700">{fmt(a)}</td>
                  ))}
                  <td className="py-2 ps-2 text-center font-semibold">{fmt(v.annual)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-2 pe-2"><Bi {...L("general")} /></td>
              <td />
              {termAvgs.map((a, i) => (
                <td key={i} className="px-1 py-2 text-center">{fmt(a)}</td>
              ))}
              <td className="py-2 ps-2 text-center text-blue-900">{fmt(annual.average)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" dir="ltr">
        <Box label={L("annual")} value={fmt(annual.average)} strong />
        <Box label={L("rank")} value={rank ? `${rank} / ${ranked}` : "—"} />
        <Box label={L("classAverage")} value={fmt(data.classStats?.mean)} />
        <Box
          label={L("decision")}
          value={`${fr.decisions[decision]} · ${ar.decisions[decision]}`}
          tone={decision === "PASS" ? "text-green-700" : decision === "FAIL" ? "text-red-700" : "text-slate-600"}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500" dir="ltr">
        {t(fr.reportCards.formula, { formula, pass: data.rule.passMark })}
        {!annual.complete && <span className="block">{fr.reportCards.provisional}</span>}
      </p>

      <footer className="mt-6 flex justify-end" dir="ltr">
        <div className="w-48 border-t border-slate-300 pt-1 text-center text-xs text-slate-500">
          <Bi {...L("signature")} />
        </div>
      </footer>
    </article>
  );
}

function Box({ label, value, strong, tone = "" }: { label: { fr: string; ar: string }; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${strong ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"}`}>
      <p className="text-xs text-slate-500"><Bi {...label} className="items-center" /></p>
      <p className={`mt-1 ${strong ? "text-2xl font-bold text-blue-900" : "text-base font-semibold"} ${tone}`}>{value}</p>
    </div>
  );
}

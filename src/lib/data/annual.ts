import "server-only";
import type { Cycle } from "@prisma/client";
import { db } from "@/lib/db";
import { annualAverage, DEFAULT_ANNUAL_RULES, proposeDecision, type Decision } from "@/lib/grades/annual";
import { ranks, stats } from "@/lib/grades/compute";
import { computeClassReport, getTerms } from "./grades";

export async function getAnnualRule(schoolId: string, cycle: Cycle) {
  const rule = await db.annualRule.findUnique({ where: { schoolId_cycle: { schoolId, cycle } } });
  return rule ? { termWeights: rule.termWeights, passMark: rule.passMark, custom: true } : { ...DEFAULT_ANNUAL_RULES[cycle], custom: false };
}

/**
 * Résultats de l'année pour une classe : moyenne de chaque trimestre,
 * moyenne annuelle, rang et décision proposée ; et par matière.
 */
export async function computeClassAnnual(schoolId: string, classGroupId: string) {
  const cls = await db.classGroup.findFirst({ where: { schoolId, id: classGroupId }, include: { gradeLevel: true } });
  if (!cls) return null;
  const terms = await getTerms(schoolId, cls.academicYearId, cls.gradeLevel.cycle);
  const rule = await getAnnualRule(schoolId, cls.gradeLevel.cycle);
  const reports = (await Promise.all(terms.map((t) => computeClassReport(schoolId, classGroupId, t.id)))).filter((r) => r != null);
  const base = reports[0];
  if (!base) return null;

  const students = base.students;
  const termGenerals = (id: string) => reports.map((r) => r.generals.get(id) ?? null);
  const annual = new Map(students.map((s) => [s.id, annualAverage(termGenerals(s.id), rule.termWeights)]));
  const averages = new Map(students.map((s) => [s.id, annual.get(s.id)!.average]));
  const rankMap = ranks(averages);
  const decisions = new Map<string, Decision>(
    students.map((s) => {
      const a = annual.get(s.id)!;
      return [s.id, proposeDecision(a.average, a.complete, rule.passMark)];
    }),
  );

  // Par matière : moyenne de chaque trimestre et moyenne annuelle de la matière.
  const subjects = base.subjects.map((row, i) => ({
    subject: row.subject,
    coefficient: row.coefficient,
    byStudent: new Map(
      students.map((s) => {
        const perTerm = reports.map((r) => r.subjects.find((x) => x.subject.id === row.subject.id)?.averages.get(s.id) ?? null);
        return [s.id, { perTerm, annual: annualAverage(perTerm, rule.termWeights).average }];
      }),
    ),
    index: i,
  }));

  const lastTerm = terms[terms.length - 1];
  const lastReport = reports[reports.length - 1];
  return {
    cls: base.cls,
    terms,
    rule,
    students,
    termGenerals: new Map(students.map((s) => [s.id, termGenerals(s.id)])),
    annual,
    ranks: rankMap,
    decisions,
    subjects,
    classStats: stats([...averages.values()]),
    /** Le bulletin annuel suit la publication du dernier trimestre. */
    published: !!(lastTerm && lastReport && lastReport.publication),
  };
}

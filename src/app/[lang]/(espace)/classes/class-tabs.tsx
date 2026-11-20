import type { Dictionary } from "@/i18n/dictionaries";
import { Tabs } from "@/components/tabs";

/** Onglets d'une classe : élèves, notes, bulletins, matières. */
export function ClassTabs({ lang, classId, dict, active }: { lang: string; classId: string; dict: Dictionary; active: "students" | "grades" | "reports" | "curriculum" | "attendance" }) {
  const base = `/${lang}/classes/${classId}`;
  return (
    <Tabs
      active={active}
      items={[
        { key: "students", href: base, label: dict.classes.students },
        { key: "attendance", href: `${base}/absences`, label: dict.attendance.rollCall },
        { key: "grades", href: `${base}/notes`, label: dict.grades.title },
        { key: "reports", href: `${base}/bulletins`, label: dict.reportCards.title },
        { key: "curriculum", href: `${base}/matieres`, label: dict.curriculum.title },
      ]}
    />
  );
}

/** Onglets des trimestres. */
export function TermTabs({ terms, activeId, hrefFor, lang }: { terms: { id: string; nameFr: string; nameAr: string }[]; activeId: string; hrefFor: (id: string) => string; lang: string }) {
  return (
    <Tabs
      active={activeId}
      items={terms.map((t) => ({ key: t.id, href: hrefFor(t.id), label: lang === "ar" ? t.nameAr : t.nameFr }))}
    />
  );
}

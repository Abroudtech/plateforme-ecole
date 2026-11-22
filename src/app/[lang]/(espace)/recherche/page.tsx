import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { className, personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scopeOf } from "@/lib/auth/scope";
import { getCurrentYear } from "@/lib/data/school";
import { quickSearch } from "@/lib/data/students";
import { Button, Card, Input, PageHeader } from "@/components/ui";

/** Recherche rapide : un élève, un parent (nom ou téléphone) ou une classe. */
export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/recherche">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  // « Encaisser un paiement » depuis l'accueil : l'élève choisi ouvre sa page de paiements.
  const forPayment = sp.pour === "paiement";
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "students.read");
  const year = await getCurrentYear(ctx.school.id);
  const scope = await scopeOf(ctx);
  const payMode = forPayment && can(ctx.roles, "payments.write");
  const r = await quickSearch(ctx.school.id, year?.id ?? null, q, scope, can(ctx.roles, "students.write") && !payMode);
  const studentHref = (id: string) => (payMode ? `/${lang}/eleves/${id}/paiements` : `/${lang}/eleves/${id}`);
  const s = dict.search;
  const empty = q.trim().length >= 2 && r.students.length + r.guardians.length + r.classes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={payMode ? s.payTitle : s.title} subtitle={payMode ? s.payHint : undefined} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />
      <form className="flex gap-2" role="search">
        <div className="flex-1">
          {payMode && <input type="hidden" name="pour" value="paiement" />}
          <Input name="q" type="search" defaultValue={q} placeholder={s.placeholder} aria-label={s.title} autoFocus />
        </div>
        <Button type="submit">{dict.common.search}</Button>
      </form>
      {q.trim().length > 0 && q.trim().length < 2 && <p className="text-sm text-slate-500">{s.tooShort}</p>}
      {empty && <Card><p className="text-sm text-slate-500">{s.none}</p></Card>}

      {r.students.length > 0 && (
        <Card title={dict.students.title}>
          <ul className="divide-y divide-slate-100">
            {r.students.map((st) => {
              const cls = st.enrollments[0]?.classGroup;
              return (
                <li key={st.id}>
                  <Link href={studentHref(st.id)} className="flex items-center justify-between gap-3 py-3 hover:text-blue-700">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{personName(st, lang)}</span>
                      <bdi className="text-xs text-slate-500">{st.studentNumber}</bdi>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-sm">{cls ? className(cls, lang) : dict.students.noClass}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {r.guardians.length > 0 && (
        <Card title={dict.guardians.title}>
          <ul className="divide-y divide-slate-100">
            {r.guardians.map((g) => (
              <li key={g.id} className="py-3">
                <p className="font-medium">
                  {personName(g, lang)}
                  {g.phone && <bdi dir="ltr" className="ms-2 text-sm font-normal text-slate-500">{g.phone}</bdi>}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {g.students.map(({ student }) => (
                    <Link key={student.id} href={studentHref(student.id)} className="rounded-full bg-blue-50 px-2.5 py-1 text-sm text-blue-900 hover:bg-gold-100">
                      {personName(student, lang)}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!payMode && r.classes.length > 0 && (
        <Card title={dict.nav.classes}>
          <ul className="divide-y divide-slate-100">
            {r.classes.map((c) => (
              <li key={c.id}>
                <Link href={`/${lang}/classes/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-blue-700">
                  <span className="font-medium">{className(c, lang)}</span>
                  <span className="text-sm text-slate-500">{pickName(c.gradeLevel, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

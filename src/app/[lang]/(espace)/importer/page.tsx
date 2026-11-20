import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { getCurrentYear } from "@/lib/data/school";
import { Card, PageHeader } from "@/components/ui";
import { importWorkbook } from "./actions";
import { ImportForm } from "./import-form";

export default async function ImportPage({ params }: PageProps<"/[lang]/importer">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "import.write");
  const im = dict.importer;
  const year = await getCurrentYear(ctx.school.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={im.title} subtitle={im.subtitle} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />

      {!year && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{im.issues.noYear}</p>}

      <Card title={`1. ${im.step1}`}>
        <p className="mb-3 text-sm text-slate-600">{im.step1Text}</p>
        <a
          href={`/${lang}/importer/modele`}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
        >
          <span aria-hidden>⬇</span> {im.download}
        </a>
      </Card>

      <Card title={`2. ${im.step2}`}>
        <ul className="list-disc space-y-1 ps-5 text-sm text-slate-700">
          {im.step2Points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>

      <Card title={`3. ${im.step3}`}>
        <ImportForm lang={lang} labels={im} action={importWorkbook.bind(null, lang)} />
      </Card>
    </div>
  );
}

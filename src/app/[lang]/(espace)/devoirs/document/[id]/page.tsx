import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { canReadHomework } from "@/lib/data/homework";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";

/** Document de l'atelier joint à une séance du cahier de textes, en lecture (parents, élèves). */
export default async function HomeworkDocumentPage({ params }: PageProps<"/[lang]/devoirs/document/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const hw = await db.homework.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: { resource: { include: { gradeLevel: true, subject: true } } },
  });
  if (!hw?.resource || !(await canReadHomework(ctx, hw))) notFound();
  const r = hw.resource;
  const dir = r.language === "ar" ? "rtl" : "ltr";
  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={r.title}
          subtitle={`${pickName(r.gradeLevel, lang)} · ${pickName(r.subject, lang)}`}
          back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
          action={<PrintButton label={dict.workshop.print} />}
        />
      </div>
      <article lang={r.language} dir={dir} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/80 print:p-0 print:shadow-none print:ring-0 sm:p-8">
        <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-blue-900 pb-3 text-sm">
          <div>
            <p className="font-bold text-blue-900">{ctx.school.nameAr}</p>
            <p className="text-slate-600">{ctx.school.nameFr}</p>
          </div>
          <div className="text-end text-slate-600">
            <p>{r.language === "ar" ? r.gradeLevel.nameAr : r.gradeLevel.nameFr}</p>
            <p>{r.language === "ar" ? r.subject.nameAr : r.subject.nameFr}</p>
          </div>
        </header>
        <div className="doc-markdown">
          <Markdown remarkPlugins={[remarkGfm]}>{r.content}</Markdown>
        </div>
      </article>
    </div>
  );
}

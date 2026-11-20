import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { deleteResource } from "../actions";

/** Document de l'atelier, prêt à imprimer avec l'en-tête de l'école. */
export default async function ResourcePage({ params }: PageProps<"/[lang]/atelier/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "ai.use");
  const w = dict.workshop;
  const r = await db.teachingResource.findFirst({
    where: { id, schoolId: ctx.school.id },
    include: { gradeLevel: true, subject: true, author: true },
  });
  if (!r || (r.authorId !== ctx.user.id && !ctx.roles.includes("ADMIN"))) notFound();
  const dir = r.language === "ar" ? "rtl" : "ltr";
  const school = ctx.school;

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={r.title}
          subtitle={`${w.kinds[r.kind].title} · ${pickName(r.gradeLevel, lang)} · ${pickName(r.subject, lang)} · ${personName(r.author, lang)}`}
          back={{ href: `/${lang}/atelier`, label: w.title }}
          action={<PrintButton label={w.print} />}
        />
        <p className="mt-2 rounded-xl bg-gold-50 p-3 text-sm text-gold-900 ring-1 ring-gold-200">{w.reviewNote}</p>
      </div>

      <article lang={r.language} dir={dir} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/80 print:p-0 print:shadow-none print:ring-0 sm:p-8">
        <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-blue-900 pb-3 text-sm">
          <div>
            <p className="font-bold text-blue-900">{school.nameAr}</p>
            <p className="text-slate-600">{school.nameFr}</p>
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

      <div className="print:hidden">
        <ActionForm action={deleteResource.bind(null, lang, r.id)} labels={formLabels(dict, w.delete)} variant="danger" confirm={`${w.delete} ?`} />
      </div>
    </div>
  );
}

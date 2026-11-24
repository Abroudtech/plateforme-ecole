import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { splitAnswerKey } from "@/lib/ai/answer-key";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { deleteResource, updateResource } from "../actions";

const VERSIONS = ["complet", "eleve", "corrige"] as const;

/**
 * Document de l'atelier, prêt à imprimer avec l'en-tête de l'école.
 * Un examen ou une série d'exercices s'imprime aussi sans le corrigé (version élève).
 */
export default async function ResourcePage({ params, searchParams }: PageProps<"/[lang]/atelier/[id]">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
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
  const base = `/${lang}/atelier/${r.id}`;

  if (sp.modifier === "1") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={w.editText} subtitle={r.title} back={{ href: base, label: r.title }} />
        <Card>
          <ActionForm action={updateResource.bind(null, lang, r.id)} labels={{ ...formLabels(dict, w.saveText), errors: dict.formErrors as Record<string, string> }}>
            <p className="text-xs text-slate-500">{w.editHint}</p>
            <Textarea name="content" rows={24} defaultValue={r.content} dir={dir} lang={r.language} className="font-mono text-sm" required minLength={10} maxLength={60000} />
          </ActionForm>
        </Card>
      </div>
    );
  }

  const parts = splitAnswerKey(r.content);
  const version = parts.key ? VERSIONS.find((v) => v === sp.version) ?? "complet" : "complet";
  const shown = version === "eleve" ? parts.student : version === "corrige" ? parts.key! : r.content;
  const versionLabel = { complet: w.versionFull, eleve: w.versionStudent, corrige: w.versionKey };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 print:hidden">
        <PageHeader
          title={r.title}
          subtitle={`${w.kinds[r.kind].title} · ${pickName(r.gradeLevel, lang)} · ${pickName(r.subject, lang)} · ${personName(r.author, lang)}`}
          back={{ href: `/${lang}/atelier`, label: w.title }}
          action={<PrintButton label={parts.key ? w.printThis : w.print} />}
        />
        <p className="rounded-xl bg-gold-50 p-3 text-sm text-gold-900 ring-1 ring-gold-200">{w.reviewNote}</p>
        <div className="flex flex-wrap items-center gap-2">
          {parts.key &&
            VERSIONS.map((v) => (
              <Link
                key={v}
                href={v === "complet" ? base : `${base}?version=${v}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${version === v ? "bg-blue-900 text-white ring-blue-900" : "bg-white ring-slate-200 hover:ring-gold-400"}`}
              >
                {versionLabel[v]}
              </Link>
            ))}
          <Link href={`${base}?modifier=1`} className="ms-auto inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-blue-900 ring-1 ring-slate-200 hover:ring-gold-400">
            <Pencil size={14} aria-hidden /> {w.editText}
          </Link>
        </div>
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
          <Markdown remarkPlugins={[remarkGfm]}>{shown}</Markdown>
        </div>
      </article>

      <div className="print:hidden">
        <ActionForm action={deleteResource.bind(null, lang, r.id)} labels={formLabels(dict, w.delete)} variant="danger" confirm={`${w.delete} ?`} />
      </div>
    </div>
  );
}

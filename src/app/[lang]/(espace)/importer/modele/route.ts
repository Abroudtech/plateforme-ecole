import { isLocale } from "@/i18n/config";
import { requirePermission } from "@/lib/auth/context";
import { templateData } from "@/lib/data/import";
import { buildTemplate } from "@/lib/import/excel";

/** Télécharge le modèle Excel à remplir, pré-rempli avec ce que l'école contient déjà. */
export async function GET(_request: Request, { params }: RouteContext<"/[lang]/importer/modele">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "fr";
  const ctx = await requirePermission(lang, "import.write");
  const buffer = await buildTemplate(await templateData(ctx.school.id, lang));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modele-import-${ctx.school.slug}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { isLocale, type Locale } from "@/i18n/config";
import { requirePermission } from "@/lib/auth/context";
import { applyPlan, loadSnapshot, newId } from "@/lib/data/import";
import { readWorkbook } from "@/lib/import/excel";
import { parseWorkbook } from "@/lib/import/parse";
import { planImport, type Plan, type RowReport } from "@/lib/import/plan";
import type { SheetKey } from "@/lib/import/schema";

export type ImportState =
  | {
      error?: string;
      mode?: "preview" | "done";
      fileName?: string;
      found?: SheetKey[];
      counts?: Plan["counts"];
      /** Lignes à signaler (erreurs et remarques), limitées pour l'affichage. */
      rows?: RowReport[];
      hiddenRows?: number;
    }
  | undefined;

const MAX_SIZE = 4 * 1024 * 1024;
const MAX_ROWS_SHOWN = 300;

/**
 * Vérifie le fichier (mode « preview ») ou l'importe (mode « commit »).
 * Dans les deux cas, le fichier est relu entièrement : l'aperçu montre
 * exactement ce que l'import fera.
 */
export async function importWorkbook(rawLang: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  const lang: Locale = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requirePermission(lang, "import.write");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
  if (file.size > MAX_SIZE) return { error: "tooBig" };

  let sheets;
  try {
    sheets = await readWorkbook(await file.arrayBuffer());
  } catch {
    return { error: "unreadable" };
  }
  const book = parseWorkbook(sheets);
  if (book.found.length === 0) return { error: "noSheets" };

  const snapshot = await loadSnapshot(ctx.school.id);
  const plan = planImport(book, snapshot, newId);
  const commit = formData.get("mode") === "commit";

  if (commit) {
    try {
      await applyPlan(ctx.school.id, snapshot.yearId, plan);
    } catch (e) {
      // Quelqu'un a ajouté les mêmes données entre l'aperçu et l'import.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "conflict" };
      throw e;
    }
    refresh();
  }

  const notable = plan.rows.filter((r) => r.issues.length > 0);
  // Les erreurs d'abord, dans l'ordre du fichier.
  notable.sort((a, b) => Number(b.status === "error") - Number(a.status === "error"));
  return {
    mode: commit ? "done" : "preview",
    fileName: file.name,
    found: book.found,
    counts: plan.counts,
    rows: notable.slice(0, MAX_ROWS_SHOWN),
    hiddenRows: Math.max(0, notable.length - MAX_ROWS_SHOWN),
  };
}

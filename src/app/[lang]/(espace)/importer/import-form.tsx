"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { SHEETS, SHEET_KEYS, type SheetKey } from "@/lib/import/schema";
import type { Issue, } from "@/lib/import/parse";
import type { ImportState } from "./actions";

type Labels = Dictionary["importer"];

/** Remplace {x} par sa valeur ; en arabe, le nom de colonne est traduit. */
function issueText(labels: Labels, issue: Issue, lang: string) {
  const template = (labels.issues as Record<string, string>)[issue.key] ?? issue.key;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = issue.params?.[k];
    if (v == null) return m;
    if (k === "column" && lang === "ar") {
      const col = SHEETS.flatMap((s) => s.columns).find((c) => c.fr === v);
      return col?.ar ?? v;
    }
    return v;
  });
}

const STATUS_STYLE = {
  create: "text-green-700",
  update: "text-blue-700",
  exists: "text-slate-500",
  error: "text-red-700",
} as const;

export function ImportForm({
  lang,
  labels,
  action,
}: {
  lang: string;
  labels: Labels;
  action: (state: ImportState, formData: FormData) => Promise<ImportState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Numéro du fichier choisi : l'aperçu ne vaut que pour ce fichier-là.
  const [fileVersion, setFileVersion] = useState(0);
  const [previewedVersion, setPreviewedVersion] = useState(-1);
  const [mode, setMode] = useState<"preview" | "commit">("preview");

  const showPreview = state?.mode === "preview" && previewedVersion === fileVersion;
  const showDone = state?.mode === "done" && previewedVersion === fileVersion;
  const counts = state?.counts;
  const toWrite = counts ? SHEET_KEYS.reduce((n, k) => n + counts[k].create + counts[k].update, 0) : 0;
  const sheetName = (k: SheetKey) => labels.sheets[k];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const m = submitter?.value === "commit" ? "commit" : "preview";
        if (m === "commit" && !window.confirm(labels.confirm)) return;
        const data = new FormData(e.currentTarget);
        data.set("mode", m);
        setMode(m);
        setPreviewedVersion(fileVersion);
        startTransition(() => formAction(data));
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        <span>{labels.chooseFile}</span>
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={() => setFileVersion((v) => v + 1)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base file:me-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-800"
        />
      </label>

      {state?.error && previewedVersion === fileVersion && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {(labels.fileErrors as Record<string, string>)[state.error] ?? labels.fileErrors.unreadable}
        </p>
      )}

      {!showPreview && !showDone && (
        <div>
          <button type="submit" value="preview" disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            {pending ? labels.checking : labels.check}
          </button>
        </div>
      )}

      {(showPreview || showDone) && counts && (
        <div className="flex flex-col gap-4">
          {showDone ? (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{labels.done}</p>
          ) : (
            <p className="text-sm text-slate-600">{labels.previewIntro}</p>
          )}

          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {SHEET_KEYS.filter((k) => state.found?.includes(k)).map((k) => {
              const c = counts[k];
              return (
                <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <span className="font-semibold">{sheetName(k)}</span>
                  <span className="flex flex-wrap gap-x-3">
                    {(["create", "update", "exists", "error"] as const).map((s) =>
                      c[s] > 0 ? (
                        <span key={s} className={STATUS_STYLE[s]}>
                          {c[s]} {(showDone ? labels.statusDone : labels.status)[s]}
                        </span>
                      ) : null,
                    )}
                    {c.create + c.update + c.exists + c.error === 0 && <span className="text-slate-400">{labels.emptySheet}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          {state.rows && state.rows.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{labels.details}</h3>
              <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-start font-medium">{labels.where}</th>
                      <th className="px-2 py-2 text-start font-medium">{labels.what}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((r) => (
                      <tr key={`${r.sheet}-${r.row}`} className="border-t border-slate-100 align-top">
                        <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                          {sheetName(r.sheet)}
                          <br />
                          <span className="text-xs">{labels.row} {r.row}</span>
                        </td>
                        <td className="px-2 py-2">
                          {r.label && <p className="font-medium" dir="auto">{r.label}</p>}
                          {r.issues.map((i, n) => (
                            <p key={n} className={STATUS_STYLE[r.status]} dir="auto">{issueText(labels, i, lang)}</p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!!state.hiddenRows && <p className="mt-1 text-xs text-slate-500">+ {state.hiddenRows}</p>}
            </div>
          )}

          {showPreview && counts && SHEET_KEYS.some((k) => counts[k].error > 0) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{labels.errorsSkipped}</p>
          )}

          {showPreview && (
            <div className="flex flex-wrap gap-2">
              {toWrite > 0 ? (
                <button type="submit" value="commit" disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                  {pending && mode === "commit" ? labels.importing : labels.importNow}
                </button>
              ) : (
                <p className="text-sm text-slate-600">{labels.nothingToImport}</p>
              )}
              <button type="submit" value="preview" disabled={pending} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
                {pending && mode === "preview" ? labels.checking : labels.checkAgain}
              </button>
            </div>
          )}

          {showDone && (
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link href={`/${lang}/eleves`} className="text-blue-700 hover:underline">{labels.seeStudents}</Link>
              <Link href={`/${lang}/classes`} className="text-blue-700 hover:underline">{labels.seeClasses}</Link>
              <Link href={`/${lang}/enseignants`} className="text-blue-700 hover:underline">{labels.seeTeachers}</Link>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

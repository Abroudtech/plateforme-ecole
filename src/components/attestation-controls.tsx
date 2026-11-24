import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { PrintButton } from "@/components/print-button";

/**
 * Réglages d'une attestation (type, langue, date) : un simple formulaire
 * qui recharge la page. Rien n'est enregistré.
 */
export function AttestationControls({
  dict,
  kinds,
  kind,
  docLang,
  date,
  warnings,
  settingsHref,
}: {
  dict: Dictionary;
  kinds: { value: string; label: string; disabled?: boolean }[];
  kind: string;
  docLang: "fr" | "ar";
  date: string;
  warnings: string[];
  settingsHref: string | null;
}) {
  const A = dict.attestations;
  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm";
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <form className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        {kinds.length > 1 ? (
          <label className="col-span-2 flex flex-col gap-1 text-sm font-medium sm:col-span-1">
            {A.kind}
            <select name="type" defaultValue={kind} className={field}>
              {kinds.map((k) => (
                <option key={k.value} value={k.value} disabled={k.disabled}>{k.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="col-span-2 self-center font-semibold sm:col-span-1">{kinds[0]?.label}</p>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {A.language}
          <select name="langue" defaultValue={docLang} className={field}>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {A.date}
          <input type="date" name="date" defaultValue={date} className={field} dir="ltr" />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button type="submit" className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">{A.show}</button>
          <PrintButton label={A.print} />
        </div>
      </form>
      <p className="text-xs text-slate-500">{A.printHint}</p>
      {warnings.map((w) => (
        <p key={w} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {w}
          {settingsHref && w === A.missingDirector && (
            <>
              {" "}
              <Link href={settingsHref} className="font-semibold underline">{A.settingsLink}</Link>
            </>
          )}
        </p>
      ))}
    </div>
  );
}

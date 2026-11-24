import { Zap } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { LIVE_SECONDS } from "@/lib/live";
import { launchLive } from "@/app/[lang]/(espace)/direct/actions";
import { ActionForm } from "./action-form";

/** Bouton « Lancer en direct » d'un défi, avec le temps par question. */
export function LiveLaunch({ lang, challengeId, dict }: { lang: string; challengeId: string; dict: Dictionary }) {
  const l = dict.live;
  return (
    <section id="direct" className="rounded-2xl bg-blue-950 p-4 text-white shadow-card sm:p-5">
      <p className="flex items-center gap-2 text-lg font-bold"><Zap size={20} className="text-gold-300" aria-hidden /> {l.title}</p>
      <p className="mt-1 text-sm text-white/75">{l.launchHint}</p>
      <ActionForm
        action={launchLive.bind(null, lang, challengeId)}
        labels={{ submit: `⚡ ${l.launch}`, pending: dict.common.saving, errors: dict.formErrors as Record<string, string> }}
        className="mt-3 flex flex-wrap items-center gap-3 [&_button[type=submit]]:bg-gold-500 [&_button[type=submit]]:text-blue-950"
      >
        <label className="flex items-center gap-2 text-sm">
          {l.seconds}
          <select name="seconds" defaultValue="20" className="rounded-lg bg-white px-2 py-1.5 text-blue-950">
            {LIVE_SECONDS.map((s) => (
              <option key={s} value={s}>{t(l.secondsValue, { count: s })}</option>
            ))}
          </select>
        </label>
      </ActionForm>
    </section>
  );
}

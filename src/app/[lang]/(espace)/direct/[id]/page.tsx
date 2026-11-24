import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireContext } from "@/lib/auth/context";
import { liveState } from "@/lib/data/live";
import { db } from "@/lib/db";
import { LiveScreen } from "./live-screen";

/** Défi en direct : écran de la classe (enseignant) ou téléphone de l'élève. */
export default async function LivePage({ params }: PageProps<"/[lang]/direct/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const state = await liveState(ctx, id, lang);
  if (!state) notFound();
  const live = await db.liveQuiz.findUniqueOrThrow({ where: { id }, select: { challengeId: true, classGroupId: true } });
  const backHref = state.role === "host" ? `/${lang}/espace-classe/defis/${live.challengeId}` : `/${lang}/tableau-de-bord`;
  const { launch: _a, launchHint: _b, seconds: _c, secondsValue: _d, join: _e, banner: _f, ended: _g, results: _h, ...labels } = dict.live;
  return <LiveScreen id={id} lang={lang} initial={state} labels={labels} backHref={backHref} />;
}

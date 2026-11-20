import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { GAME_KEYS, SCORED_GAMES_PER_DAY } from "@/lib/games";
import { t } from "@/i18n/format";
import { PageHeader } from "@/components/ui";

const GAME_ICONS: Record<(typeof GAME_KEYS)[number], string> = { calcul: "⚡", tables: "✖️", lettres: "ح", mots: "🔤" };

/** Jeux éducatifs : chaque bonne réponse rapporte un point au classement de la classe. */
export default async function GamesPage({ params }: PageProps<"/[lang]/jeux">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  await requirePermission(lang, "student.space");
  const gm = dict.games;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={dict.nav.games} subtitle={t(gm.subtitle, { count: SCORED_GAMES_PER_DAY })} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {GAME_KEYS.map((k) => (
          <li key={k}>
            <Link href={`/${lang}/jeux/${k}`} className="flex h-full items-center gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-900 text-2xl font-bold text-gold-300">{GAME_ICONS[k]}</span>
              <span>
                <span className="block text-lg font-bold">{gm.list[k].title}</span>
                <span className="block text-sm text-slate-500">{gm.list[k].text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

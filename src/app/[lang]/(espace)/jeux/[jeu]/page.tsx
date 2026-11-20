import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { studentOf } from "@/lib/data/class-space";
import { isGameKey, levelNumber } from "@/lib/games";
import { PageHeader } from "@/components/ui";
import { saveGame } from "../../espace-classe/actions";
import { GamePlayer } from "./game-player";

export default async function GamePage({ params }: PageProps<"/[lang]/jeux/[jeu]">) {
  const { lang: rawLang, jeu } = await params;
  const lang = rawLang as Locale;
  if (!isGameKey(jeu)) notFound();
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "student.space");
  const student = await studentOf(ctx.school.id, ctx.user.id);
  const gm = dict.games;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={gm.list[jeu].title} subtitle={gm.list[jeu].text} back={{ href: `/${lang}/jeux`, label: dict.nav.games }} />
      <GamePlayer
        game={jeu}
        level={levelNumber(student?.classGroup?.gradeLevel.code)}
        save={async (score) => {
          "use server";
          return saveGame(lang, jeu, score);
        }}
        labels={{
          start: gm.start,
          again: gm.again,
          score: gm.score,
          counted: gm.counted,
          notCounted: gm.notCounted,
          back: dict.nav.games,
          backHref: `/${lang}/jeux`,
          time: gm.time,
        }}
      />
    </div>
  );
}

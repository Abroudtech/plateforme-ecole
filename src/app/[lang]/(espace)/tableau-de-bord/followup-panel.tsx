import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { studentsToFollow } from "@/lib/data/followup";
import { FollowupList } from "@/components/followup";
import { Panel } from "./dashboard-ui";

/** Accueil : les élèves à suivre (calculé à part pour ne pas ralentir le reste de la page). */
export async function FollowupPanel({ schoolId, classIds, money, lang, dict, className = "" }: { schoolId: string; classIds: string[] | null; money: boolean; lang: Locale; dict: Dictionary; className?: string }) {
  const rows = await studentsToFollow(schoolId, classIds, { money });
  const f = dict.followup;
  return (
    <Panel title={f.title} className={className}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{f.none}</p>
      ) : (
        <>
          <FollowupList rows={rows.slice(0, 6)} lang={lang} dict={dict} />
          <Link href={`/${lang}/eleves-a-suivre`} className="mt-3 inline-block text-sm font-semibold text-blue-800 hover:underline">
            {t(f.seeAll, { count: rows.length })}
          </Link>
        </>
      )}
    </Panel>
  );
}

export function FollowupFallback({ dict, className = "" }: { dict: Dictionary; className?: string }) {
  return (
    <Panel title={dict.followup.title} className={className}>
      <p className="text-sm text-slate-400">…</p>
    </Panel>
  );
}

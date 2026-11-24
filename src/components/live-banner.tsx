import Link from "next/link";
import { Zap } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { activeLive } from "@/lib/data/live";

/** Bandeau de l'élève quand son enseignant lance un défi en direct. */
export async function LiveBanner({ schoolId, classId, lang, dict }: { schoolId: string; classId: string; lang: string; dict: Dictionary }) {
  const live = await activeLive(schoolId, classId);
  if (!live) return null;
  return (
    <Link href={`/${lang}/direct/${live.id}`} className="flex items-center gap-3 rounded-2xl bg-gold-500 p-4 text-blue-950 shadow-card ring-2 ring-gold-300 hover:bg-gold-400">
      <span className="grid h-12 w-12 shrink-0 animate-pulse place-items-center rounded-full bg-blue-950 text-gold-300"><Zap size={24} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{dict.live.banner}</span>
        <span className="block truncate text-sm" dir="auto">{live.challenge.title}</span>
      </span>
      <span className="shrink-0 rounded-xl bg-blue-950 px-4 py-2 font-bold text-white">{dict.live.join}</span>
    </Link>
  );
}

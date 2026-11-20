import "server-only";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import type fr from "./dictionaries/fr.json";

export type Dictionary = typeof fr;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
};

/** Charge les textes de l'interface dans la langue demandée. */
export async function getDictionary(lang: string): Promise<Dictionary> {
  if (!isLocale(lang)) notFound();
  return dictionaries[lang]();
}

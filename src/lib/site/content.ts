import type { Locale } from "@/i18n/config";

/**
 * Règles du contenu de la page vitrine (sans base de données, testées
 * automatiquement dans tests/site.test.ts).
 */

/** Texte dans la langue de la page, sinon dans l'autre langue. */
export function pickText(fr: string | null | undefined, ar: string | null | undefined, lang: Locale): string {
  const a = fr?.trim() ?? "";
  const b = ar?.trim() ?? "";
  return lang === "ar" ? b || a : a || b;
}

export type Highlight = { titleFr: string; titleAr: string; textFr: string; textAr: string };

export const MAX_HIGHLIGHTS = 6;

/** Lit la liste des atouts enregistrée (JSON), en ignorant ce qui est mal formé ou vide. */
export function parseHighlights(raw: unknown): Highlight[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return raw
    .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
    .map((h) => ({ titleFr: str(h.titleFr), titleAr: str(h.titleAr), textFr: str(h.textFr), textAr: str(h.textAr) }))
    .filter((h) => h.titleFr || h.titleAr || h.textFr || h.textAr)
    .slice(0, MAX_HIGHLIGHTS);
}

export type CycleTexts = Partial<Record<"PRIMARY" | "MIDDLE" | "SECONDARY", { fr: string; ar: string }>>;

export function parseCycleTexts(raw: unknown): CycleTexts {
  const out: CycleTexts = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const cycle of ["PRIMARY", "MIDDLE", "SECONDARY"] as const) {
    const v = (raw as Record<string, unknown>)[cycle];
    if (v && typeof v === "object") {
      const { fr, ar } = v as Record<string, unknown>;
      out[cycle] = { fr: typeof fr === "string" ? fr.trim() : "", ar: typeof ar === "string" ? ar.trim() : "" };
    }
  }
  return out;
}

/**
 * Adresse saisie (« https://www.Laplume-dor.tn/ ») ramenée à sa forme simple
 * (« laplume-dor.tn »). Renvoie null si ce n'est pas un nom de domaine.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (d.startsWith("www.")) d = d.slice(4);
  if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  return d;
}

/** Lien web saisi par l'école : on accepte « facebook.com/ecole » en ajoutant https://. */
export function normalizeUrl(input: string | null | undefined): string | null {
  const v = input?.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Numéro WhatsApp au format international sans « + » (pour les liens wa.me). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 8) return `216${digits}`; // numéro tunisien sans indicatif
  if (digits.startsWith("00")) return digits.slice(2);
  return digits.length >= 10 ? digits : null;
}

/** Paragraphes d'un texte long (séparés par une ligne vide ou un retour à la ligne). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Type réel d'une image d'après ses premiers octets (on ne se fie pas au nom du fichier). */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const MAX_GALLERY_PHOTOS = 30;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

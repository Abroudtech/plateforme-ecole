import { describe, expect, it } from "vitest";
import { detectImageType, normalizeDomain, normalizeUrl, paragraphs, parseCycleTexts, parseHighlights, pickText, whatsappNumber } from "@/lib/site/content";
import { siteTheme } from "@/lib/site/themes";
import { can } from "@/lib/auth/permissions";

describe("page vitrine", () => {
  it("affiche le texte dans la langue de la page, sinon dans l'autre", () => {
    expect(pickText("Bienvenue", "مرحبا", "ar")).toBe("مرحبا");
    expect(pickText("Bienvenue", "  ", "ar")).toBe("Bienvenue");
    expect(pickText(null, "مرحبا", "fr")).toBe("مرحبا");
    expect(pickText(null, undefined, "fr")).toBe("");
  });

  it("ramène une adresse saisie à un nom de domaine simple", () => {
    expect(normalizeDomain("https://www.Laplume-dor.tn/")).toBe("laplume-dor.tn");
    expect(normalizeDomain("laplume-dor.tn:443")).toBe("laplume-dor.tn");
    expect(normalizeDomain("app.laplume-dor.tn")).toBe("app.laplume-dor.tn");
    expect(normalizeDomain("localhost:3000")).toBeNull();
    expect(normalizeDomain("pas une adresse")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });

  it("accepte les liens sans https:// et refuse le reste", () => {
    expect(normalizeUrl("facebook.com/laplume")).toBe("https://facebook.com/laplume");
    expect(normalizeUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("bonjour")).toBeNull();
    expect(normalizeUrl("  ")).toBeNull();
  });

  it("prépare le numéro WhatsApp", () => {
    expect(whatsappNumber("+216 22 123 456")).toBe("21622123456");
    expect(whatsappNumber("22123456")).toBe("21622123456");
    expect(whatsappNumber("00216 22123456")).toBe("21622123456");
    expect(whatsappNumber("123")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });

  it("lit les atouts et les textes des cycles en ignorant le reste", () => {
    expect(parseHighlights([{ titleFr: " Cantine " }, { titleFr: "" }, "x", null])).toEqual([{ titleFr: "Cantine", titleAr: "", textFr: "", textAr: "" }]);
    expect(parseHighlights(Array.from({ length: 9 }, () => ({ titleFr: "a" })))).toHaveLength(6);
    expect(parseHighlights("n'importe quoi")).toEqual([]);
    expect(parseCycleTexts({ PRIMARY: { fr: "Primaire", ar: 3 }, AUTRE: { fr: "x" } })).toEqual({ PRIMARY: { fr: "Primaire", ar: "" } });
  });

  it("découpe un texte en paragraphes", () => {
    expect(paragraphs("Un\n\nDeux\nTrois\n")).toEqual(["Un", "Deux", "Trois"]);
  });

  it("reconnaît les vraies images d'après leur contenu", () => {
    const pad = (b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]);
    expect(detectImageType(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("utilise la couleur par défaut si le thème est inconnu", () => {
    expect(siteTheme("inconnu")).toEqual(siteTheme("encre"));
  });

  it("seule la direction modifie la page vitrine", () => {
    expect(can(["ADMIN"], "site.write")).toBe(true);
    expect(can(["TEACHER", "PARENT", "STUDENT"], "site.write")).toBe(false);
  });
});

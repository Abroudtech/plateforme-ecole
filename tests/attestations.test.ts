import { describe, expect, it } from "vitest";
import { levelLabel, schoolTitle, shortDate, studentAttestation, workAttestation, type SchoolInfo } from "@/lib/attestations";

const school: SchoolInfo = {
  nameFr: "La Plume d'or",
  nameAr: "القلم الذهبي",
  address: "Rue Abdelkrim El Oued",
  addressAr: "نهج عبد الكريم الواد",
  city: "Moknine",
  cityAr: "المكنين",
  directorName: "Ibrahim Krefa",
  directorNameAr: "إبراهيم كريفة",
  cycles: ["PRIMARY"],
};
const P2 = { code: "P2", cycle: "PRIMARY", nameFr: "2e année", nameAr: "السنة الثانية" };
const P3 = { code: "P3", cycle: "PRIMARY", nameFr: "3e année", nameAr: "السنة الثالثة" };
const date = new Date("2026-11-10T00:00:00Z");
const birth = new Date("2019-05-14T00:00:00Z");

describe("attestations", () => {
  it("présente l'école comme dans le modèle", () => {
    expect(schoolTitle(school, "fr")).toBe("École primaire privée « La Plume d'or »");
    expect(schoolTitle(school, "ar")).toBe("المدرسة الابتدائية الخاصّة «القلم الذهبي»");
    expect(schoolTitle({ ...school, nameFr: "École Privée Démo", cycles: ["PRIMARY", "MIDDLE"] }, "fr")).toBe("École Privée Démo");
    expect(levelLabel(P2, "fr")).toBe("2e année primaire");
    expect(levelLabel({ code: "C7", cycle: "MIDDLE", nameFr: "7e année de base", nameAr: "السنة السابعة أساسي" }, "fr")).toBe("7e année de base");
    expect(shortDate(birth)).toBe("14/05/2019");
  });

  it("attestation de présence en arabe, accordée au masculin", () => {
    const a = studentAttestation("presence", "ar", school, { name: "يزيد العطاوي", gender: "MALE", birthDate: birth, birthPlace: null }, [{ label: "2026-2027", level: P2 }], date);
    expect(a.title).toBe("شهادة حضور");
    expect(a.place).toBe("المكنين في 10/11/2026");
    expect(a.paragraphs[0].text).toContain("بأنّ التلميذ «يزيد العطاوي» المولود في 14/05/2019 مرسّم بالسنة الثانية ابتدائي خلال السنة الدراسية 2026-2027");
    expect(a.paragraphs[0].text).toContain("إبراهيم كريفة");
    expect(a.paragraphs[1].text).toContain("سلّمت له");
    expect(a.signerName).toBe("إبراهيم كريفة");
  });

  it("attestation de présence en français, accordée au féminin", () => {
    const a = studentAttestation("presence", "fr", school, { name: "Rima Hajri", gender: "FEMALE", birthDate: birth, birthPlace: "Monastir" }, [{ label: "2026-2027", level: P2 }], date);
    expect(a.title).toBe("Attestation de présence");
    expect(a.place).toBe("Moknine, le 10/11/2026");
    expect(a.paragraphs[0].text).toBe(
      "Je soussigné Ibrahim Krefa, directeur de l'école primaire privée « La Plume d'or », sise à Rue Abdelkrim El Oued Moknine, atteste par la présente que l'élève Rima Hajri, née le 14/05/2019 à Monastir, est inscrite en 2e année primaire et poursuit actuellement (2026-2027) ses études dans notre établissement.",
    );
    expect(a.paragraphs[1].text).toContain("de l'intéressée");
  });

  it("attestation scolaire : toutes les années, sexe inconnu", () => {
    const a = studentAttestation(
      "scolarite",
      "fr",
      { ...school, directorName: null },
      { name: "Sami Ben Ali", gender: null, birthDate: null, birthPlace: null },
      [{ label: "2025-2026", level: P2 }, { label: "2026-2027", level: P3 }],
      date,
    );
    expect(a.paragraphs[0].text).toContain("Je soussigné directeur de");
    expect(a.paragraphs[0].text).toContain("régulièrement inscrit(e) dans notre établissement pour les années scolaires suivantes : 2e année primaire (2025-2026), 3e année primaire (2026-2027).");
  });

  it("attestation de travail d'une enseignante", () => {
    const fr = workAttestation("fr", school, { name: "Oumaima Guibene", gender: "FEMALE", cin: "06991894", hiredOn: new Date("2023-10-15T00:00:00Z"), subjects: [] }, date);
    expect(fr.title).toBe("Attestation de travail");
    expect(fr.paragraphs[0].text).toContain("que Mme Oumaima Guibene, titulaire de la CIN n° 06991894, est enseignante dans notre établissement depuis le 15/10/2023.");
    const ar = workAttestation("ar", school, { name: "ريم زخّامة", gender: "FEMALE", cin: null, hiredOn: null, subjects: ["الرياضيات"] }, date);
    expect(ar.title).toBe("شهادة عمل");
    expect(ar.paragraphs[0].text).toContain("أشهد بأنّ السيّدة «ريم زخّامة» تعمل مدرّسة بالمؤسسة المذكورة، وتدرّس الرياضيات.");
  });
});

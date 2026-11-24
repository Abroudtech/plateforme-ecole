import { describe, expect, it } from "vitest";
import fr from "@/i18n/dictionaries/fr.json";
import ar from "@/i18n/dictionaries/ar.json";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("traductions", () => {
  it("le français et l'arabe ont exactement les mêmes textes", () => {
    expect(keys(ar).sort()).toEqual(keys(fr).sort());
  });

  it("aucun texte arabe n'est vide", () => {
    const values = JSON.stringify(ar).match(/"[^"]*":""/g);
    expect(values).toBeNull();
  });

  it("remplace les variables", () => {
    expect(t("Bonjour {name}", { name: "Manar" })).toBe("Bonjour Manar");
  });

  it("accorde les mots au pluriel", () => {
    const tpl = "{count} {count:élève|élèves}";
    expect(t(tpl, { count: 0 })).toBe("0 élève");
    expect(t(tpl, { count: 1 })).toBe("1 élève");
    expect(t(tpl, { count: 3 })).toBe("3 élèves");
    expect(t("{rank}{rank:re|e}", { rank: 1 })).toBe("1re");
    expect(t("{rank}{rank:re|e}", { rank: 4 })).toBe("4e");
    const ar = "{n:لا تلميذ|تلميذ واحد|تلميذان|تلاميذ|تلميذًا|تلميذ}";
    expect(t(ar, { n: 2 })).toBe("تلميذان");
    expect(t(ar, { n: 5 })).toBe("تلاميذ");
    expect(t(ar, { n: 11 })).toBe("تلميذًا");
    expect(t("{count:0 قسم|قسم واحد|قسمان|{count} أقسام|{count} قسمًا|{count} قسم}", { count: 4 })).toBe("4 أقسام");
  });

  it("chaque accord au pluriel de l'arabe a ses six formes", () => {
    const plurals = JSON.stringify(ar).match(/\{\w+:(?:[^{}]|\{\w+\})*\}/g) ?? [];
    for (const p of plurals) expect(p.split("|").length, p).toBe(6);
  });

  it("chaque accord au pluriel du français a ses deux formes", () => {
    const plurals = JSON.stringify(fr).match(/\{\w+:(?:[^{}]|\{\w+\})*\}/g) ?? [];
    for (const p of plurals) expect(p.split("|").length, p).toBe(2);
  });

  it("affiche le nom dans la bonne langue, avec repli sur le français", () => {
    expect(pickName({ nameFr: "Collège", nameAr: "الإعدادي" }, "ar")).toBe("الإعدادي");
    expect(pickName({ nameFr: "7B1", nameAr: null }, "ar")).toBe("7B1");
    expect(personName({ firstName: "Adam", lastName: "Ben Salah", firstNameAr: "آدم", lastNameAr: "بن صالح" }, "ar")).toBe("آدم بن صالح");
    expect(personName({ firstName: "Adam", lastName: "Ben Salah" }, "ar")).toBe("Adam Ben Salah");
  });
});

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

  it("affiche le nom dans la bonne langue, avec repli sur le français", () => {
    expect(pickName({ nameFr: "Collège", nameAr: "الإعدادي" }, "ar")).toBe("الإعدادي");
    expect(pickName({ nameFr: "7B1", nameAr: null }, "ar")).toBe("7B1");
    expect(personName({ firstName: "Adam", lastName: "Ben Salah", firstNameAr: "آدم", lastNameAr: "بن صالح" }, "ar")).toBe("آدم بن صالح");
    expect(personName({ firstName: "Adam", lastName: "Ben Salah" }, "ar")).toBe("Adam Ben Salah");
  });
});

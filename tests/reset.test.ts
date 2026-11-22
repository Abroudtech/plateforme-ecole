import { describe, expect, it } from "vitest";
import { hashResetCode, newResetCode } from "@/lib/auth/reset-code";
import { identifierWhere } from "@/lib/auth/identifier";

describe("mot de passe oublié", () => {
  it("code à 6 chiffres", () => {
    for (let i = 0; i < 50; i++) expect(newResetCode()).toMatch(/^\d{6}$/);
  });
  it("l'empreinte dépend de la demande et du code", () => {
    expect(hashResetCode("a", "123456")).toBe(hashResetCode("a", "123456"));
    expect(hashResetCode("a", "123456")).not.toBe(hashResetCode("b", "123456"));
    expect(hashResetCode("a", "123456")).not.toBe(hashResetCode("a", "123457"));
  });
  it("retrouve le compte par e-mail, téléphone ou identifiant élève", () => {
    expect(identifierWhere(" Parent@Demo.tn ")).toEqual({ email: "parent@demo.tn" });
    expect(identifierWhere("22 000 000")).toEqual({ phone: "+21622000000" });
    expect(identifierWhere("yasmine.2026001")).toEqual({ username: "yasmine.2026001" });
  });
});

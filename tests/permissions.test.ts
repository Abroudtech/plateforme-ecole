import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";

describe("rôles et permissions", () => {
  it("l'administration gère les paiements, pas les parents", () => {
    expect(can(["ADMIN"], "payments.write")).toBe(true);
    expect(can(["PARENT"], "payments.write")).toBe(false);
  });

  it("un parent ne voit que l'espace de ses enfants", () => {
    expect(can(["PARENT"], "children.read")).toBe(true);
    expect(can(["PARENT"], "students.read")).toBe(false);
  });

  it("un élève n'a aucun accès en V1", () => {
    expect(can(["STUDENT"], "messages.send")).toBe(false);
    expect(can(["STUDENT"], "students.read")).toBe(false);
  });

  it("plusieurs rôles se cumulent", () => {
    expect(can(["PARENT", "TEACHER"], "students.read")).toBe(true);
  });
});

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

describe("journal de classe et attestations", () => {
  it("l'enseignant écrit son journal, la direction le lit", () => {
    expect(can(["TEACHER"], "journal.write")).toBe(true);
    expect(can(["ADMIN"], "journal.write")).toBe(false);
    expect(can(["ADMIN"], "journal.read")).toBe(true);
    expect(can(["PARENT"], "journal.read")).toBe(false);
  });

  it("seule la direction délivre les attestations", () => {
    expect(can(["ADMIN"], "attestations.write")).toBe(true);
    expect(can(["TEACHER"], "attestations.write")).toBe(false);
  });
});

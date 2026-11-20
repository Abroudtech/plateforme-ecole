import { describe, expect, it } from "vitest";
import { amountInputValue, computeAccount, formatMoney, parseAmount, whatsappLink } from "@/lib/payments";

describe("parseAmount", () => {
  it("lit les saisies courantes en dinars", () => {
    expect(parseAmount("1250")).toBe(1_250_000);
    expect(parseAmount("1 250,500")).toBe(1_250_500);
    expect(parseAmount("12.5")).toBe(12_500);
    expect(parseAmount("0,250 DT")).toBe(250);
  });
  it("refuse le reste", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1.2345")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formate en français et en arabe", () => {
    expect(formatMoney(1_250_500, "fr")).toBe("1 250,500 DT");
    expect(formatMoney(250, "fr")).toBe("0,250 DT");
    expect(formatMoney(1_250_500, "ar")).toBe("1250.500 د.ت");
  });
  it("valeur de champ", () => {
    expect(amountInputValue(1_250_000)).toBe("1250");
    expect(amountInputValue(12_500)).toBe("12.5");
  });
});

describe("computeAccount", () => {
  const charges = [
    { id: "t2", amount: 1000, dueDate: "2027-01-05" },
    { id: "ins", amount: 300, dueDate: "2026-09-15" },
    { id: "t1", amount: 1000, dueDate: "2026-10-01" },
  ];
  it("répartit les paiements par échéance et calcule le retard", () => {
    const a = computeAccount(charges, 800, "2026-11-20");
    expect(a.lines.map((l) => [l.id, l.paid, l.status])).toEqual([
      ["ins", 300, "paid"],
      ["t1", 500, "overdue"],
      ["t2", 0, "upcoming"],
    ]);
    expect(a.balance).toBe(1500);
    expect(a.overdue).toBe(500);
    expect(a.credit).toBe(0);
  });
  it("partiel non échu, avance", () => {
    expect(computeAccount(charges, 1800, "2026-11-20").lines[2].status).toBe("partial");
    const a = computeAccount(charges, 2500, "2026-11-20");
    expect(a.balance).toBe(0);
    expect(a.credit).toBe(200);
    expect(a.overdue).toBe(0);
  });
  it("frais exonéré (0) est payé", () => {
    expect(computeAccount([{ id: "x", amount: 0, dueDate: "2026-01-01" }], 0, "2026-11-20").lines[0].status).toBe("paid");
  });
});

describe("whatsappLink", () => {
  it("nettoie le numéro et encode le texte", () => {
    expect(whatsappLink("+216 22 000 000", "Bonjour à vous")).toBe("https://wa.me/21622000000?text=Bonjour%20%C3%A0%20vous");
  });
});

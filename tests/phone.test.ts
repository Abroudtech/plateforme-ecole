import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("numéros de téléphone", () => {
  it("reconnaît les formats tunisiens courants", () => {
    expect(normalizePhone("22 000 000")).toBe("+21622000000");
    expect(normalizePhone("+216 22 000 000")).toBe("+21622000000");
    expect(normalizePhone("0021622000000")).toBe("+21622000000");
  });

  it("refuse ce qui n'est pas un numéro", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

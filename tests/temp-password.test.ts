import { describe, expect, it } from "vitest";
import { generateTempPassword } from "@/lib/auth/temp-password";

describe("mot de passe provisoire", () => {
  it("fait 8 caractères faciles à dicter (sans 0, O, 1, l, I)", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(8);
      expect(pw).not.toMatch(/[01OolI]/);
    }
  });
});

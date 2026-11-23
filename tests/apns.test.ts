import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { apnsConfig, apnsJwt, apnsPayload, isApnsToken } from "@/lib/apns";

describe("notifications iPhone (APNs)", () => {
  it("signe un jeton d'accès vérifiable avec la clé Apple", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const key = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = apnsJwt({ key, keyId: "ABC123DEFG", teamId: "TEAM123456" }, 1_700_000_000);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "ABC123DEFG" });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_700_000_000 });
    const ok = verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("ne s'active que si les trois réglages sont présents", () => {
    expect(apnsConfig({})).toBeNull();
    const cfg = apnsConfig({ APNS_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----", APNS_KEY_ID: "K", APPLE_TEAM_ID: "T" });
    expect(cfg?.key).toContain("\nabc\n");
    expect(cfg?.host).toBe("https://api.push.apple.com");
    expect(cfg?.topic).toBe("fr.abroudtech.ecole");
  });

  it("prépare le message et vérifie les jetons d'appareil", () => {
    expect(apnsPayload({ title: "Absence", body: "Adam est absent", url: "/fr/absences", tag: "abs" })).toEqual({
      aps: { alert: { title: "Absence", body: "Adam est absent" }, sound: "default", "thread-id": "abs" },
      url: "/fr/absences",
    });
    expect(isApnsToken("a".repeat(64))).toBe(true);
    expect(isApnsToken("pas-un-jeton")).toBe(false);
  });
});

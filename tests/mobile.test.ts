import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE_ID, androidFingerprints, assetLinks } from "@/lib/mobile/config";
import { legal } from "@/lib/mobile/legal";

describe("applications mobiles", () => {
  it("publie le lien de confiance Android avec la clé d'envoi", () => {
    const [link] = assetLinks("");
    expect(link.target.package_name).toBe(ANDROID_PACKAGE_ID);
    expect(link.target.sha256_cert_fingerprints).toHaveLength(1);
  });

  it("ajoute l'empreinte de Google donnée sur Render, sans doublon ni valeur invalide", () => {
    const google = "aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99";
    const list = androidFingerprints(`${google}, pas-une-empreinte, ${google.toUpperCase()}`);
    expect(list).toHaveLength(2);
    expect(list[1]).toBe(google.toUpperCase());
  });

  it("a les mêmes sections de confidentialité en français et en arabe", () => {
    expect(legal.ar.privacy).toHaveLength(legal.fr.privacy.length);
    expect(legal.ar.deletion).toHaveLength(legal.fr.deletion.length);
  });
});

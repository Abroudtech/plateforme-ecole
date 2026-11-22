/**
 * Réglages des applications Play Store / App Store.
 *
 * Les applications affichent ce site : chaque évolution du site arrive donc
 * dans les applications sans les republier. Voir mobile/README.md.
 */

/** Identifiant de l'application Android sur le Play Store (définitif une fois publié). */
export const ANDROID_PACKAGE_ID = "fr.abroudtech.ecole";

/**
 * Empreintes des clés qui signent l'application Android. Le téléphone vérifie
 * que l'application et le site appartiennent bien au même propriétaire avant
 * d'afficher le site en plein écran (sans barre d'adresse).
 *
 * - La première est notre « clé d'envoi » (celle qui signe les fichiers .aab).
 * - Celle de Google (Play Console > Intégrité de l'application > Signature de
 *   l'application) s'ajoute sans toucher au code avec la variable
 *   d'environnement ANDROID_SHA256_FINGERPRINTS sur Render (plusieurs
 *   empreintes séparées par des virgules).
 */
const UPLOAD_KEY_FINGERPRINT =
  "E5:47:2C:97:A4:40:E0:04:D7:10:D5:B9:C4:BC:9A:FA:A5:A8:2C:60:18:C0:85:E5:B1:75:75:DA:22:F4:98:FE";

export function androidFingerprints(extra = process.env.ANDROID_SHA256_FINGERPRINTS): string[] {
  const fromEnv = (extra ?? "")
    .split(/[,\s]+/)
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  return [...new Set([UPLOAD_KEY_FINGERPRINT, ...fromEnv])];
}

/** Contenu de /.well-known/assetlinks.json (lien de confiance site ↔ application Android). */
export function assetLinks(extra?: string) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_ID,
        sha256_cert_fingerprints: androidFingerprints(extra),
      },
    },
  ];
}

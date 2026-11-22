# Applications Play Store et App Store

Les deux applications **affichent le site en ligne** (https://ecole-5tdk.onrender.com)
en plein écran, avec l'icône et le nom de la plateforme.

**Conséquence importante : toute évolution du site arrive immédiatement dans
les applications, sans republier sur les stores.** On ne refait une
application que si l'on change son nom, son icône, son adresse, ou si l'on
ajoute une fonction propre au téléphone (par exemple les notifications
natives sur iPhone).

| | Android (Play Store) | iPhone (App Store) |
|---|---|---|
| Technique | « Trusted Web Activity » fabriquée avec [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) | Coque [Capacitor](https://capacitorjs.com) |
| Dossier | `mobile/android/twa-manifest.json` | `mobile/ios/` |
| Fabrication | Actions > « Application Android » > Run workflow | Actions > « Application iPhone » > Run workflow |
| Résultat | fichier `.aab` à déposer dans la Play Console | envoi direct sur App Store Connect (TestFlight) |
| Notifications | celles du site, déjà en place | à ajouter (notifications natives Apple) |
| Identifiant | `fr.abroudtech.ecole` | `fr.abroudtech.ecole` |

## Android

- Le lien de confiance entre le site et l'application est publié par le site
  à l'adresse `/.well-known/assetlinks.json` (voir `src/lib/mobile/config.ts`).
  Sans lui, l'application afficherait une barre d'adresse en haut.
- Après la création de l'application dans la Play Console, copier l'empreinte
  SHA-256 de Google (Intégrité de l'application > Signature de l'application)
  dans la variable `ANDROID_SHA256_FINGERPRINTS` du service `ecole` sur Render.
- La clé d'envoi est dans les secrets GitHub `ANDROID_KEYSTORE_BASE64` et
  `ANDROID_KEYSTORE_PASSWORD` (alias `upload`). Sans eux, le workflow signe
  avec une clé de test (fichier inutilisable sur le Play Store).
- Chaque fabrication prend automatiquement un numéro de version plus grand.

## iPhone

- `mobile/ios/capacitor.config.json` : adresse du site, couleurs, et la
  mention `PlateformeEcoleApp` ajoutée à l'identifiant du navigateur pour que
  le site sache qu'il est dans l'application.
- `mobile/ios/www/hors-ligne.html` : page affichée sans connexion Internet.
- Secrets GitHub à ajouter pour l'envoi sur App Store Connect :
  `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY` (contenu du fichier `.p8`, clé avec le rôle Admin).
- Apple refuse parfois les applications qui « ne font qu'afficher un site »
  (règle 4.2). Les notifications natives et le mode hors ligne aident à
  passer cette étape.

## Changer d'adresse (nom de domaine)

Si le site passe sur un nom de domaine à soi (par exemple `ecole.mondomaine.com`),
remplacer l'adresse dans `mobile/android/twa-manifest.json` (host, iconUrl,
maskableIconUrl, webManifestUrl, fullScopeUrl) et dans
`mobile/ios/capacitor.config.json` + `mobile/ios/www/*.html`, puis refaire et
republier les deux applications. Mieux vaut donc choisir l'adresse définitive
avant la première publication.

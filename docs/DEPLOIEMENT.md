# Mettre la plateforme en ligne

Ce guide explique comment installer la plateforme sur un serveur, pour que
l'école et les parents y accèdent depuis Internet avec une adresse comme
`https://ecole-oliviers.tn`.

Tout le nécessaire est déjà prêt dans le dossier [`deploy/`](../deploy) :
le serveur web, la base de données, le certificat HTTPS automatique et la
sauvegarde quotidienne.

Deux façons de faire :

- **Hébergement géré Render (recommandé si l'école n'a pas d'informaticien)** :
  aucun serveur à entretenir, sauvegardes et HTTPS automatiques, environ 13 $
  par mois. Voir la section [0](#0-hébergement-géré-render-recommandé).
- **Serveur loué (VPS)** : moins cher (6 à 15 € par mois) mais demande une
  personne technique pour l'installation et l'entretien. Sections 1 à 3.

---

## 0. Hébergement géré Render (recommandé)

Tout est décrit dans le fichier [`render.yaml`](../render.yaml) : le site
(offre Starter, 7 $/mois) et la base PostgreSQL (offre Basic 256 Mo, 6 $/mois),
tous deux à Francfort. La base est mise à jour automatiquement à chaque
démarrage, et chaque fusion sur `main` met le site à jour tout seul.

1. Créer un compte sur [render.com](https://render.com) avec son compte GitHub,
   et ajouter un moyen de paiement.
2. **New > Blueprint**, choisir le dépôt `plateforme-ecole`, puis **Apply**.
   La base et le site se créent (5 à 10 minutes la première fois).
3. Adresse du site : dans le service `ecole`, **Settings > Custom Domains >
   Add**, saisir par exemple `ecole.mondomaine.com`. Render indique une cible
   du type `ecole-xxxx.onrender.com`. Dans le DNS du domaine (par exemple le
   centre d'administration Microsoft 365 > Paramètres > Domaines > DNS),
   ajouter un enregistrement **CNAME** : nom `ecole`, valeur cette cible. Ne
   pas toucher aux enregistrements MX, TXT ou autodiscover de la messagerie.
   Le certificat HTTPS arrive tout seul quelques minutes après.
4. Créer l'école et le premier compte (une seule fois) : dans le service
   `ecole`, onglet **Shell**, coller la commande de la section 2, étape 5,
   **sans** la partie `docker compose run --rm` ni `migrate`, c'est-à-dire :
   ```bash
   ECOLE_NOM_FR="École Les Oliviers" ECOLE_NOM_AR="مدرسة الزياتين" \
   ECOLE_VILLE="Sfax" ECOLE_CYCLES="PRIMARY,MIDDLE,SECONDARY" ANNEE="2026-2027" \
   ADMIN_EMAIL="direction@ecole.tn" ADMIN_PRENOM="Prénom" ADMIN_NOM="Nom" \
   npm run ecole:creer
   ```
   **Page vitrine sur le domaine principal** (ex. `laplume-dor.tn`) : ajouter
   aussi ce domaine (et `www.`) dans **Custom Domains** du service `ecole`,
   faire pointer le DNS comme indiqué par Render, puis saisir le domaine dans
   **Espace plateforme > l'école > Page vitrine : adresse propre**.
5. Sauvegardes : Render garde de quoi revenir à n'importe quel moment des
   3 derniers jours (base `ecole-base` > **Recovery**). Pour garder une copie
   chez soi, utiliser **Export** de temps en temps.
6. SMS (plus tard) : service `ecole` > **Environment**, ajouter
   `SMS_API_URL`, `SMS_API_TOKEN` et `SMS_SENDER`.
7. Atelier IA des enseignants : créer une clé sur
   [console.anthropic.com](https://console.anthropic.com) (**API Keys** >
   **Create Key**, avec un moyen de paiement), puis service `ecole` >
   **Environment** > **Add Environment Variable** : `ANTHROPIC_API_KEY` = la clé.
   Facultatif : `AI_MONTHLY_LIMIT` (documents par mois et par école, 300 par
   défaut). Sans clé, l'atelier affiche simplement « pas encore activé ».

---

## 1. Ce qu'il faut avoir (à faire par l'école)

| Quoi | Pourquoi | Exemple / ordre de prix |
|---|---|---|
| **Un serveur (VPS)** Linux, 2 Go de mémoire, 40 Go de disque | Fait tourner le site et la base | OVHcloud, Hetzner, Contabo, ou un hébergeur tunisien : environ 5 à 15 € par mois |
| **Un nom de domaine** | L'adresse du site | `.tn` (via un registrar agréé par l'ATI) ou `.com` : environ 10 à 40 € par an |
| **Un accès au DNS du domaine** | Faire pointer l'adresse vers le serveur | fourni par le registrar |
| (plus tard) **Un fournisseur SMS** | Envoyer les alertes aux parents | opérateur tunisien ou passerelle SMS en ligne |

Données personnelles : la plateforme contient des informations sur des
mineurs. En Tunisie, la loi organique n° 2004-63 s'applique : il est conseillé
de faire la déclaration auprès de l'INPDP et d'informer les parents.

## 2. Installation sur le serveur (à faire par une personne technique, environ 30 minutes)

1. Installer Docker sur le serveur (Ubuntu) :
   `curl -fsSL https://get.docker.com | sh`
2. Dans le DNS du domaine, créer un enregistrement **A** qui pointe vers
   l'adresse IP du serveur.
3. Récupérer le code et préparer les réglages :
   ```bash
   git clone https://github.com/Abroudtech/plateforme-ecole.git
   cd plateforme-ecole/deploy
   cp .env.exemple .env
   nano .env        # DOMAINE et DB_PASSWORD (long mot de passe au hasard)
   ```
4. Démarrer :
   ```bash
   docker compose up -d --build
   ```
   La base est créée, mise à jour, puis le site démarre. Le certificat HTTPS
   est obtenu tout seul, en général en moins d'une minute.
5. Créer l'école et le premier compte de la direction (une seule fois) :
   ```bash
   docker compose run --rm \
     -e ECOLE_NOM_FR="École Les Oliviers" -e ECOLE_NOM_AR="مدرسة الزياتين" \
     -e ECOLE_VILLE="Sfax" -e ECOLE_CYCLES="PRIMARY,MIDDLE,SECONDARY" \
     -e ANNEE="2026-2027" \
     -e ADMIN_EMAIL="direction@ecole.tn" -e ADMIN_PRENOM="Prénom" -e ADMIN_NOM="Nom" \
     migrate npm run ecole:creer
   ```
   Le mot de passe provisoire s'affiche : se connecter, puis le changer dans
   **Compte**.
6. Programmer la sauvegarde chaque nuit (`crontab -e`) :
   ```
   0 2 * * * /chemin/vers/plateforme-ecole/deploy/sauvegarde.sh
   ```
   Copier régulièrement le dossier `deploy/sauvegardes/` ailleurs (autre
   serveur, disque, stockage en ligne).

⚠️ Ne **jamais** lancer `npm run db:seed` sur le serveur : c'est la commande
qui ajoute l'école de démonstration.

## 3. Mettre à jour la plateforme

Après chaque nouvelle version fusionnée sur GitHub :

```bash
cd plateforme-ecole && git pull
cd deploy && docker compose up -d --build
```

Les évolutions de la base sont appliquées automatiquement avant le
redémarrage du site.

## 4. Premiers pas dans l'école

1. **Paramètres** : vérifier le nom, l'adresse et le téléphone de l'école
   (ils apparaissent sur les bulletins et les reçus) et la formule de la
   moyenne annuelle.
2. **Paramètres > Équipe** : ajouter les comptes du secrétariat et de la
   comptabilité.
3. **Classes** : créer les classes, puis vérifier les matières et coefficients.
4. **Élèves** : inscrire les élèves et leurs parents, puis créer les accès
   parents (identifiants à leur remettre).
5. **Paiements > Frais** : saisir les frais de l'année.
6. **Emplois du temps** : ajouter les enseignants, les salles et les cours.

## 5. Brancher les SMS (plus tard)

Ajouter dans `deploy/.env` les informations du fournisseur :

```
SMS_API_URL=https://...
SMS_API_TOKEN=...
SMS_SENDER=ECOLE
```

puis `docker compose up -d`. La plateforme envoie à cette adresse
`{ "to": "+216…", "from": "ECOLE", "text": "…" }`. Si le fournisseur attend un
autre format, une petite adaptation de `src/lib/sms.ts` suffit.

## 5 bis. Activer l'atelier IA

Ajouter dans `deploy/.env` la clé créée sur console.anthropic.com :

```
ANTHROPIC_API_KEY=sk-ant-...
AI_MONTHLY_LIMIT=300
```

puis `docker compose up -d`. Chaque document coûte quelques centimes ; la
limite mensuelle évite les mauvaises surprises.

## 6. Vérifier que tout fonctionne

- `https://votre-domaine/api/sante` doit afficher `{"ok":true}`.
- `docker compose ps` : tous les services sont « running » (sauf `migrate`,
  qui s'arrête normalement après avoir mis la base à jour).
- `docker compose logs app` : les messages du site, en cas de problème.

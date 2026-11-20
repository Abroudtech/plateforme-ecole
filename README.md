# Plateforme École

Plateforme de gestion scolaire pour les écoles privées tunisiennes :
administration, parents, et plus tard enseignants et élèves.
Web d'abord, pensée pour le téléphone, en **français et en arabe**.

## Où en est-on ?

| Étape | Contenu | État |
|---|---|---|
| 1. Fondation | Structure, base de données multi-établissement, connexion et rôles, français/arabe | ✅ |
| 2. Élèves et classes | Ajouter, modifier, inscrire les élèves ; gérer les classes ; parents et accès parents | ✅ |
| 3. Notes et bulletins | Matières et coefficients, saisie des notes, moyennes et rang, bulletins bilingues publiés aux parents | ✅ |
| 4. Absences | Appel matin/après-midi, absents du jour, justification, suivi parent | ✅ |
| 5. Structure des notes | Oral, contrôle, synthèse configurables par matière, niveau et classe ; saisie en tableau | ✅ |
| 6. Emplois du temps | Emploi du temps par classe, consultable par les parents | à venir |
| 7. Paiements | Frais de scolarité, échéances, relances des impayés | à venir |
| 8. Messagerie | École ↔ parents, notifications | à venir |

Le fonctionnement général est expliqué simplement dans
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technologies

- **Next.js 16 + TypeScript** : le site web (pages et logique côté serveur).
- **PostgreSQL** : la base de données.
- **Prisma** : l'outil qui décrit la base (`prisma/schema.prisma`) et la fait évoluer.
- **Tailwind CSS** : la mise en page, adaptée au téléphone et à l'arabe (droite à gauche).

## Lancer le projet sur un ordinateur (pour un développeur)

Prérequis : Node.js 22 et Docker (ou un PostgreSQL déjà installé).

```bash
cp .env.example .env          # paramètres locaux
docker compose up -d          # démarre la base de données
npm install                   # installe les dépendances
npm run db:deploy             # crée les tables
npm run db:seed               # ajoute une école de démonstration
npm run dev                   # lance le site sur http://localhost:3000
```

Comptes de démonstration (mot de passe `Demo2026!`) :

- Administration : `admin@demo.tn`
- Parent : `22 000 000` (ou `parent@demo.tn`)

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Site en mode développement |
| `npm test` | Tests automatiques |
| `npm run lint` / `npm run typecheck` | Vérifications du code |
| `npm run db:migrate` | Créer une évolution de la base après modification du schéma |
| `npm run db:studio` | Explorer la base dans le navigateur |

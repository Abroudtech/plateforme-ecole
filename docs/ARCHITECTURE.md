# Comment la plateforme est construite

Ce document explique, sans jargon, les grands choix faits dès la fondation.

## 1. Plusieurs écoles dans une seule plateforme

La plateforme sera d'abord utilisée par notre école, puis vendue à d'autres.
Plutôt que d'installer une copie par école, **toutes les écoles partagent la même
plateforme**, et chaque donnée est « étiquetée » avec l'école à laquelle elle
appartient (le champ `schoolId`).

- Une école ne voit jamais les données d'une autre : chaque lecture de la base
  filtre par l'école de la personne connectée (`src/lib/data/`).
- Un même compte peut être lié à plusieurs écoles (par exemple un parent dont
  les enfants sont dans deux établissements). Il choisit alors l'école en haut
  de l'écran.

## 2. Primaire, collège et lycée

Chaque école indique les cycles qu'elle propose. Le système tunisien est
préparé automatiquement (`src/lib/setup/tunisia.ts`) :

- **Primaire** : année préparatoire, puis 1re à 6e année.
- **Collège** : 7e, 8e et 9e année de base.
- **Lycée** : 1re à 4e année secondaire, avec les **filières** (Mathématiques,
  Sciences expérimentales, Lettres, Économie et gestion, Informatique...).

Les **matières** ont un **coefficient par niveau et par filière** : c'est ce qui
permettra de calculer correctement les moyennes et les bulletins, qui diffèrent
beaucoup entre le primaire et le lycée.

Les **périodes** (trimestres) sont rattachées à l'année scolaire et peuvent, si
besoin, être différentes selon le cycle.

## 3. Les comptes et les rôles

| Rôle | Version | Ce qu'il peut faire |
|---|---|---|
| Administration | V1 | Tout gérer pour son école |
| Parent | V1 | Voir ses enfants, leurs notes, absences, paiements ; échanger avec l'école |
| Enseignant | V2 | Notes, absences, exercices, outils d'IA |
| Élève | V3 | Défis et jeux pédagogiques dans un espace de classe encadré (pas de messagerie libre entre élèves) |

Les droits de chaque rôle sont réunis dans un seul tableau
(`src/lib/auth/permissions.ts`) : ouvrir un module à un rôle se fait à un seul endroit.

Les **parents et tuteurs** existent dans la base même sans compte sur
l'application : on pourra quand même leur envoyer des SMS ou WhatsApp (relances
de paiement, absences).

Connexion par **e-mail ou téléphone**. Les mots de passe ne sont jamais stockés
en clair, et la session de connexion dure 30 jours sur le téléphone.

## 4. Français et arabe partout

- Chaque adresse commence par la langue : `/fr/...` ou `/ar/...`. Un bouton
  permet de passer de l'une à l'autre sur la même page.
- En arabe, toute la mise en page s'inverse (de droite à gauche).
- Les textes de l'interface sont dans `src/i18n/dictionaries/` (un fichier par
  langue). Un test vérifie qu'aucun texte n'est oublié dans l'une des deux langues.
- Les noms (élèves, classes, matières, niveaux) sont enregistrés en français
  **et** en arabe, ce qui permettra des bulletins bilingues.

## 5. Organisation des fichiers

```
prisma/schema.prisma     La description de la base de données
prisma/seed.ts           L'école de démonstration
src/app/[lang]/          Les pages (une adresse = un dossier)
src/i18n/                Les traductions
src/lib/auth/            Connexion, sessions, rôles et droits
src/lib/data/            Les lectures de la base, toujours filtrées par école
src/lib/setup/           Le référentiel scolaire tunisien
tests/                   Les tests automatiques
```

## 6. Élèves, classes et parents (étape 2)

- **Classes** : créées pour l'année en cours, avec un niveau, une filière (lycée)
  et une capacité. Une classe ne peut être supprimée que si aucun élève n'y a
  jamais été inscrit.
- **Élèves** : le matricule est généré automatiquement (`2026-001`, `2026-002`...)
  si on le laisse vide. Retirer un élève ne supprime rien : il disparaît des
  listes, mais son historique (notes, paiements à venir) est conservé.
- **Parents** : si un parent est saisi avec un téléphone ou un e-mail déjà connu
  de l'école (frères et sœurs), la fiche existante est réutilisée, pas dupliquée.
- **Accès parent** : depuis la fiche de l'élève, la direction crée l'accès en un
  clic. Un mot de passe provisoire s'affiche **une seule fois**, à communiquer au
  parent ; il se connecte ensuite avec son numéro de téléphone. Par sécurité, ce
  bouton ne modifie jamais le mot de passe d'un compte du personnel.

## 7. Notes et bulletins (étape 3)

- **Matières et coefficients** : réglés par niveau (et par filière au lycée),
  depuis l'onglet « Matières et coefficients » d'une classe. Un programme par
  défaut est proposé (`src/lib/setup/tunisia.ts`) ; ce sont des valeurs
  indicatives à ajuster par l'école.
- **Évaluations** : devoir de contrôle, devoir de synthèse, oral, TP, autre.
  Chacune a un barème (sur 20 par défaut) et un poids.
- **Calcul** (`src/lib/grades/compute.ts`, testé automatiquement) :
  - chaque note est ramenée sur 20 ;
  - moyenne d'une matière = moyenne des notes pondérée par le poids de chaque
    évaluation (un élève absent n'est pas compté pour cette évaluation) ;
  - moyenne générale = moyenne des matières pondérée par les coefficients, en ne
    comptant que les matières où l'élève a une note ;
  - rang : les ex aequo ont le même rang.
- **Bulletin** : un seul document en français **et** en arabe, imprimable.
  Les parents ne le voient qu'après la **publication** par la direction, et
  uniquement pour leurs propres enfants.
- **À venir** : la moyenne annuelle (la formule diffère selon le cycle) et les
  décisions de fin d'année.

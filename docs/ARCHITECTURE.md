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

## 8. Absences (étape 4)

- **Appel** : par classe, le matin ou l'après-midi (onglet « Appel » de la
  classe). Par défaut tout le monde est présent ; on touche « Absent » ou
  « Retard » pour les exceptions. L'appel est marqué « fait » même si tout le
  monde est présent.
- **Absents du jour** (menu « Absences ») : liste de l'école pour une date,
  justification avec un motif, et liste des classes dont l'appel n'est pas fait.
- **Suivi** : fiche élève (historique et décompte) et espace parent (décompte et
  dernières absences de chaque enfant).
- Les dates et le matin/après-midi sont calculés à l'heure de Tunis.
- **À venir** : alerte automatique aux parents (SMS/WhatsApp) avec la messagerie.

## 9. Structure des notes (étape 5)

Chaque matière a une **structure d'évaluation** : les types de notes (oral,
contrôle, synthèse, TP, autre) et le poids de chacun. Par défaut :
**oral ×1, contrôle ×1, synthèse ×2**.

La structure peut être réglée à plusieurs endroits ; **la plus précise l'emporte** :

1. une classe, pour une matière ;
2. une classe, pour toutes ses matières ;
3. un niveau (et sa filière au lycée), pour une matière ;
4. un niveau, pour toutes ses matières ;
5. toute l'école ;
6. sinon, la règle par défaut.

Réglage : onglet « Matières et coefficients » d'une classe, lien sous chaque
matière (`src/lib/grades/scheme.ts`, testé).

**Saisie** : onglet « Notes » → trimestre → matière → un tableau avec une ligne
par élève et une colonne par type de note (« abs » pour un absent). Les
évaluations sont créées automatiquement. On peut ajouter des évaluations
supplémentaires (deuxième contrôle, projet…).

**Calcul de la moyenne d'une matière** : moyenne de chaque type (s'il y a deux
contrôles, on prend leur moyenne), puis moyenne des types pondérée par la
structure. Exemple : oral 12, contrôle 14, synthèse 16 → (12 + 14 + 2×16) / 4 = 14,5.

Le **bulletin** affiche une colonne par type de note.

## 10. Emplois du temps (étape 6)

- **Enseignants** (`Teacher`) : fiche simple (nom FR/AR, téléphone, e-mail), activable/désactivable.
  Le champ `userId` est prévu pour la V2, quand les enseignants auront leur propre compte.
- **Salles** (`Room`) : nom unique par école, capacité facultative.
- **Créneaux** (`TimetableEntry`) : une classe, une matière, un jour (1 = lundi … 6 = samedi),
  une heure de début et de fin (en minutes depuis minuit), un enseignant et une salle facultatifs.
- À l'ajout d'un créneau, on refuse les chevauchements (`src/lib/timetable.ts`, testé) :
  même classe, même enseignant ou même salle au même moment (sur l'année en cours).
  Le message indique la classe et l'horaire déjà occupés.
- La matière doit faire partie du programme de la classe. Les heures prévues au programme
  (`CurriculumSubject.hoursPerWeek`) sont comparées aux heures réellement placées.
- Pages : `/emplois-du-temps` (vue d'ensemble), `/classes/[id]/emploi-du-temps`,
  `/enseignants`, `/enseignants/[id]`, `/salles`, et `/eleves/[id]/emploi-du-temps` pour les parents
  (lecture seule, uniquement pour leurs enfants). Toutes les vues s'impriment.
- Droits : `timetable.read` (administration, enseignants plus tard), `timetable.write` et `staff.write`
  (administration).

## 11. Paiements et relances (étape 7)

- **Montants en millimes** (entiers, 1 DT = 1000) : aucune erreur d'arrondi. Saisie et affichage
  dans `src/lib/payments.ts` (`parseAmount`, `formatMoney`), testés.
- **Frais** (`Fee`) : définis pour l'année, pour un niveau ou toute l'école, avec une échéance.
  Un frais *obligatoire* est dû par tous les élèves concernés ; un frais *optionnel*
  (cantine, transport) seulement par les élèves inscrits au service.
- **`StudentFee`** : inscription à un service optionnel, ou montant personnalisé
  (réduction, bourse ; 0 = exonéré).
- **Paiements** (`Payment`) : imputés à une année, numéro de reçu unique et croissant par école.
  Un paiement n'est jamais supprimé : il est annulé avec un motif (le reçu reste, barré).
- **Calcul du compte** (`computeAccount`) : les paiements sont répartis sur les frais par ordre
  d'échéance ; un frais non soldé dont l'échéance est passée est « en retard ».
  Rien n'est stocké : le solde est toujours recalculé, donc toujours juste.
- **Relances** (`PaymentReminder`) : WhatsApp (lien `wa.me` avec un message en arabe et en
  français vers le parent principal), lettre bilingue imprimable, ou appel noté.
  Chaque relance est tracée. Les SMS automatiques viendront avec la messagerie (étape 8).
- Pages : `/paiements` (chiffres clés, impayés par classe), `/paiements/frais`,
  `/paiements/encaissements` (journal de caisse), `/paiements/recus/[id]`,
  `/eleves/[id]/paiements` (compte de l'élève ; lecture seule pour les parents) et
  `/eleves/[id]/paiements/relance`.

## 12. Messagerie et alertes (étape 8)

- **Conversations** (`Conversation`, `Message`) entre l'école et un parent (`Guardian`), au sujet
  d'un enfant. L'administration voit toutes les conversations ; un parent seulement les siennes.
  `ConversationRead` retient jusqu'où chacun a lu, pour afficher les « non lus ».
- **Annonces** (`Announcement`) pour toute l'école, un niveau ou une classe. Un parent ne voit que
  celles qui concernent ses enfants.
- **Alertes SMS** (`Notification`) au contact principal de l'élève, dans la langue de son compte :
  absence ou retard (à l'appel), première publication d'un bulletin, nouveau message de l'école,
  annonce (si la case est cochée ; un seul SMS par parent). Chaque type d'alerte s'active ou se
  désactive dans « Messagerie > Alertes SMS ».
- **Envoi** (`src/lib/sms.ts`) : aucun fournisseur imposé. Avec `SMS_API_URL` (voir `.env.example`),
  chaque alerte est envoyée en HTTP ; sinon elle est enregistrée comme « simulée ». Chaque alerte
  est tracée (envoyée, simulée, échec), et les échecs peuvent être renvoyés.
  WhatsApp est prévu dans le modèle (`channel`), à brancher avec un fournisseur WhatsApp Business.

## 13. Moyenne annuelle, tableau de bord, sécurité et mise en ligne

- **Moyenne annuelle** (`src/lib/grades/annual.ts`, testé) : moyenne des trimestres pondérée
  par cycle (`AnnualRule`). Par défaut, (T1 + 2×T2 + 2×T3) / 5 au collège et au lycée, et les trois
  trimestres à poids égal au primaire. La moyenne d'admission est de 10. Tout se règle dans
  **Paramètres**. La décision affichée est une *proposition* : le conseil de classe tranche.
  Le bulletin annuel est visible par les parents quand le dernier trimestre est publié.
- **Tableau de bord du directeur** (`src/lib/data/director.ts`) : la journée (absents, appels
  faits), les choses à faire (appels manquants, bulletins non publiés, impayés, messages), les
  moyennes de chaque classe, les élèves les plus absents et les encaissements.
- **Comptes** : chacun change son mot de passe dans « Compte » (les autres appareils sont alors
  déconnectés). La direction gère son équipe dans **Paramètres**.
- **Connexion** : après 5 échecs en 15 minutes pour un même identifiant, la connexion est bloquée
  15 minutes (`LoginAttempt`).
- **En-têtes de sécurité** et cookie de session `Secure` en production (`next.config.ts`).
- **Mise en ligne** : `Dockerfile` (cibles `app` et `outils`), `deploy/docker-compose.yml`
  (base, migrations, site, HTTPS automatique avec Caddy), `deploy/sauvegarde.sh`,
  `/api/sante` pour la surveillance. Création d'une vraie école : `npm run ecole:creer`
  (`scripts/creer-ecole.ts`). Guide pas à pas : [DEPLOIEMENT.md](DEPLOIEMENT.md).

## 14. Import depuis Excel

Page **Importer** (`/fr/importer`, réservée à l'administration) pour démarrer
une école en une fois : classes, matières et coefficients, salles,
enseignants, élèves (avec leur classe) et parents.

- **Modèle** (`importer/modele/route.ts`) : fichier Excel fabriqué à la demande
  avec un onglet par type de données, des en-têtes bilingues, des listes de
  choix (niveau, classe, sexe, lien du parent) et ce que l'école contient déjà.
- **Lecture** (`src/lib/import/parse.ts`) : reconnaît les onglets et les
  colonnes en français ou en arabe, et vérifie chaque ligne (téléphone, date,
  champs obligatoires...).
- **Préparation** (`src/lib/import/plan.ts`) : pour chaque ligne, dit si elle
  sera créée, complétée, ignorée (déjà présente) ou si elle est en erreur. Un
  élève existe déjà s'il a le même matricule, ou les mêmes nom et prénom (et
  la même date de naissance quand elle est connue). Un parent existe déjà
  s'il a le même téléphone ou e-mail : les frères et sœurs partagent ainsi le
  même parent.
- **Écriture** (`src/lib/data/import.ts`) : tout le plan est écrit dans une
  seule transaction. Rien n'est jamais supprimé ni déplacé, et on peut renvoyer
  le même fichier sans créer de doublons.

L'écran montre d'abord un aperçu (rien n'est enregistré), puis importe les
lignes correctes ; les lignes en erreur sont listées pour être corrigées.

## 15. Espace enseignant et atelier IA (V2)

- **Accès** : depuis la fiche d'un enseignant, la direction crée son accès
  (identifiant = téléphone ou e-mail, mot de passe provisoire) et coche ses
  classes (`TeacherAssignment`). Les classes de son emploi du temps sont
  ajoutées automatiquement.
- **Périmètre** (`src/lib/auth/scope.ts`) : un enseignant ne voit que ses
  classes et leurs élèves. Chaque page de classe (`classes/[id]/layout.tsx`)
  et chaque action (appel, notes, appréciations) vérifie ce périmètre. La
  justification des absences, les paiements et les réglages restent à la
  direction.
- **Atelier IA** (`/atelier`) : fiche de leçon, série d'exercices ou examen par
  critères (C1 à C4), pour un niveau, une matière et un thème. Les consignes
  données à l'IA sont dans `src/lib/ai/prompt.ts` et `programme-primaire.ts`
  (organisation du primaire tunisien, langue selon la matière). L'appel est
  dans `src/lib/ai/generate.ts` (modèle `claude-opus-5-5`, repli automatique
  du fournisseur en cas de refus). Le document est enregistré
  (`TeachingResource`) et s'imprime avec l'en-tête de l'école.
- **Réglages** : `ANTHROPIC_API_KEY` (sans clé, l'atelier affiche « pas encore
  activé ») et `AI_MONTHLY_LIMIT` (documents par école et par mois, 300 par
  défaut).

## 16. Espace élève et espace de classe (V3)

- **Accès élève** : depuis la fiche de l'élève, la direction crée un
  identifiant « prenom.matricule » (`src/lib/student/username.ts`) et un mot
  de passe provisoire. L'élève se connecte sur la même page que tout le monde.
- **Mur de la classe** (`ClassPost`) : l'enseignant publie ; un élève peut
  proposer un message, qui n'est visible par la classe qu'après validation de
  l'enseignant. Les élèves ne peuvent réagir que par un émoji choisi dans une
  courte liste : **aucune messagerie entre élèves**.
- **Défis** (`Challenge`, `ChallengeAttempt`) : quiz à choix multiples créés
  par l'enseignant, à la main ou proposés par l'IA puis relus. Une seule
  tentative par élève ; les bonnes réponses ne sont envoyées au navigateur
  qu'après la réponse. L'enseignant voit les résultats et les questions les
  moins réussies.
- **Jeux** (`src/lib/games`) : calcul éclair, tables de multiplication, lettre
  arabe cachée, mot français. Questions fabriquées sur place, adaptées au
  niveau. Cinq parties par jeu et par jour comptent pour le classement.
- **Classement** : 2 points par bonne réponse à un défi, 1 point par bonne
  réponse dans un jeu ; classement de la semaine et de l'année, par classe.
  Les élèves ne voient des autres que le prénom et l'initiale du nom.

## Page vitrine de l'école

Chaque école a une page publique sur Internet, réglée par la direction dans
**Site de l'école** (menu de l'administration) : couleur, logo, grande photo,
présentation, atouts, cycles, galerie de photos, inscriptions, horaires,
WhatsApp et réseaux. Chaque texte existe en français et en arabe ; si l'une
des deux langues est vide, l'autre est affichée.

- Tant que la page n'est pas **publiée**, seule la direction la voit (aperçu).
- Adresse sur la plateforme : `/fr/ecole/<identifiant-de-l-ecole>`.
- **Adresse propre** (ex. `laplume-dor.tn`) : réglée par l'équipe plateforme
  (Espace plateforme > l'école). Quand quelqu'un arrive sur ce domaine, la page
  d'accueil affiche directement la vitrine (`src/app/[lang]/page.tsx`).
- Les photos sont réduites dans le navigateur avant l'envoi, puis gardées dans
  la base (`SitePhoto`) et servies par `/api/vitrine/photo/<id>`.
- Le formulaire « Demande de renseignements » enregistre la demande
  (`SiteInquiry`) et prévient la direction par notification.

## 17. Examens et calendrier

- **Préparer un examen** (`/examens`, enseignants et direction) : classe, matière,
  type (contrôle, synthèse...), date, heure, durée, salle, ce qu'il faut réviser et,
  au choix, le sujet préparé dans l'atelier (visible seulement par l'équipe). Les
  élèves et les parents de la classe sont prévenus sur leur téléphone.
- Une alerte s'affiche si la classe a déjà un examen le même jour.
- **Saisir les notes** depuis l'examen crée une seule fois l'évaluation dans le carnet
  de notes, au trimestre qui contient la date (`termForDate`). La page de l'examen
  montre ensuite la moyenne, les notes extrêmes et la répartition.
- **Calendrier** (`/calendrier`, tous les comptes) : examens, devoirs à rendre
  (familles) et dates de l'école (`SchoolEvent` : vacances, réunions, sorties...,
  pour l'école, un niveau ou une classe), semaine par semaine sur 8 semaines.
  Seule la direction ajoute des dates. Les accueils affichent « À venir ».
- Calculs sans base de données dans `src/lib/calendar.ts` (testés).

## 18. Défi en direct

- Depuis un défi (Espace classe > Défis > « Lancer en direct »), l'enseignant
  ouvre un **écran à projeter** (`/direct/<id>`). Les élèves de la classe reçoivent
  une notification et voient un bandeau « Rejoindre » sur leur accueil.
- Étapes (`LiveQuiz.phase`) : attente des élèves → question (compte à rebours) →
  bonne réponse et répartition des choix → question suivante → podium. La réponse
  s'affiche toute seule quand le temps est écoulé ou que tout le monde a répondu.
- Points : 500 par bonne réponse + jusqu'à 500 selon la rapidité (`src/lib/live.ts`, testé).
  La bonne réponse n'est envoyée aux téléphones qu'après la question.
- L'écran et les téléphones lisent l'état chaque seconde (`/api/direct/<id>`).
- À la fin, chaque participant reçoit une tentative du défi : ses bonnes réponses
  comptent dans le classement de la classe (sans doublon s'il l'avait déjà fait).

## 19. Autorisations, devoirs cochés, version élève des sujets

- **Autorisations** (`/autorisations`, `ConsentRequest` / `ConsentReply`) : la direction
  (école, niveau ou classe) ou l'enseignant (ses classes) envoie une demande ; chaque
  parent répond « Oui » ou « Non » pour son enfant, depuis son accueil, et peut changer
  d'avis jusqu'à la date limite. L'équipe voit les réponses par classe, relance les
  parents sans réponse et imprime la liste.
- **Devoirs « fait »** (`HomeworkDone`) : l'élève coche ses devoirs (barre de progression) ;
  le parent voit « Fait » dans le cahier de textes de son enfant.
- **Atelier** : le texte d'un document se modifie, et un examen ou une série d'exercices
  s'imprime en version élève (sans corrigé) ou corrigé seul (`src/lib/ai/answer-key.ts`, testé).

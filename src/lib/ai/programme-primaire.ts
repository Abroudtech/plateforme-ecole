/**
 * Repères sur l'enseignement primaire tunisien, donnés à l'IA pour que les
 * documents collent aux usages des classes tunisiennes. Ce sont des repères
 * généraux (organisation, démarche, évaluation) : le thème précis vient
 * toujours de l'enseignant.
 */

export type DocLanguage = "ar" | "fr" | "en";

/** Langue d'enseignement d'une matière au primaire tunisien. */
export function subjectLanguage(subject: { code?: string | null; nameFr: string }): DocLanguage {
  const code = (subject.code ?? "").toUpperCase();
  const name = subject.nameFr.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (code === "FR" || name.startsWith("francais")) return "fr";
  if (code === "EN" || name.startsWith("anglais")) return "en";
  // Mathématiques, éveil scientifique, éducation islamique, etc. : en arabe.
  return "ar";
}

export const PRIMARY_CONTEXT = `
Organisation de l'école primaire tunisienne (enseignement de base, 1er cycle) :
- Six années (1re à 6e année), en trois degrés : 1er degré (1re-2e), 2e degré (3e-4e), 3e degré (5e-6e). Certaines écoles ont une année préparatoire.
- L'année est découpée en trois trimestres. Les évaluations sont notées sur 20 (sur 10 dans certaines matières des petites classes).
- Langue d'enseignement : l'arabe pour toutes les matières, sauf le français et l'anglais. Les mathématiques et l'éveil scientifique se font en arabe.
- Matières : langue arabe (lecture, expression orale, production écrite, grammaire et conjugaison à partir de la 3e, écriture/dictée), mathématiques (nombres et calcul, géométrie, mesure, résolution de problèmes), éveil scientifique, technologie, éducation islamique, éducation civique, histoire et géographie (à partir de la 5e), français, anglais, éducation artistique, musicale et physique.
- Démarche : approche par compétences. Un module (وحدة) vise une compétence terminale ; chaque séance a un objectif spécifique observable.
- Fiche de préparation (مذكرة / fiche de séance) : discipline, niveau, module, compétence, objectif de la séance, prérequis, supports et matériel, durée, puis le déroulement en étapes chronométrées — mise en situation / problème de départ, découverte ou recherche (individuelle puis en groupes), mise en commun et synthèse (trace écrite), entraînement / application, évaluation formative, et pistes de remédiation ou de soutien pour les élèves en difficulté.
- Évaluation (فرض / تقييم) : les exercices sont regroupés par critères. Les critères minimaux (معايير الحد الأدنى, souvent C1, C2, C3) portent sur l'essentiel de la compétence et représentent environ trois quarts de la note ; le critère de perfectionnement (معيار التميز, C4) sert à distinguer les meilleurs élèves. Le barème est indiqué pour chaque exercice. En fin de 6e, le concours d'entrée aux collèges pilotes (concours de la sixième) est une référence de niveau.
- Contexte : enfants tunisiens de 6 à 12 ans. Utiliser des prénoms, des lieux, des monnaies (dinar, millimes), des fêtes et des situations de la vie en Tunisie.
`.trim();

/** Repère de niveau par année, pour calibrer la difficulté. */
export const LEVEL_HINTS: Record<string, string> = {
  PREP: "Année préparatoire (5-6 ans) : pré-lecture, graphisme, découverte des nombres jusqu'à 10, activités orales et ludiques.",
  P1: "1re année (6-7 ans) : apprentissage de la lecture et de l'écriture en arabe (lettres, syllabes, mots, phrases courtes) ; nombres jusqu'à 100, addition et soustraction simples, repérage dans l'espace, formes simples.",
  P2: "2e année (7-8 ans) : lecture de textes courts, phrases simples ; débuts du français à l'oral (salutations, vocabulaire du quotidien) ; nombres jusqu'à 1000, addition et soustraction avec retenue, début de la multiplication, mesures de longueur.",
  P3: "3e année (8-9 ans) : textes narratifs courts, premières notions de grammaire et conjugaison en arabe ; français : lecture et écriture de phrases simples ; nombres jusqu'à 10 000, tables de multiplication, division simple, monnaie, figures planes.",
  P4: "4e année (9-10 ans) : lecture compréhension et production de paragraphes ; anglais à l'oral (premières notions) ; grands nombres, les quatre opérations, fractions simples, périmètre, mesures de masse et de capacité.",
  P5: "5e année (10-11 ans) : textes variés, production écrite structurée ; histoire et géographie ; fractions et nombres décimaux, proportionnalité simple, aires, angles, problèmes à plusieurs étapes.",
  P6: "6e année (11-12 ans) : consolidation de toutes les compétences du primaire, préparation au concours de la sixième ; décimaux et fractions, pourcentages, échelles, volumes, solides, problèmes complexes ; production écrite argumentée simple.",
};

import { z } from "zod";
import { LEVEL_HINTS, PRIMARY_CONTEXT, type DocLanguage } from "./programme-primaire";

export const RESOURCE_KINDS = ["LESSON", "EXERCISES", "EXAM"] as const;
export type ResourceKindName = (typeof RESOURCE_KINDS)[number];

/** Ce que l'enseignant demande dans le formulaire de l'atelier. */
export const resourceRequestSchema = z.object({
  kind: z.enum(RESOURCE_KINDS),
  gradeLevelId: z.string().min(1),
  subjectId: z.string().min(1),
  topic: z.string().trim().min(3).max(300),
  term: z.enum(["1", "2", "3"]).default("1"),
  /** Durée de la séance (fiche) ou de l'épreuve (examen), en minutes. */
  duration: z.coerce.number().int().min(15).max(180).default(45),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  /** Nombre d'exercices voulus (série d'exercices). */
  count: z.coerce.number().int().min(3).max(15).default(6),
  instructions: z.string().trim().max(1500).optional().default(""),
});
export type ResourceRequest = z.infer<typeof resourceRequestSchema>;

export type PromptInput = ResourceRequest & {
  level: { code: string; nameFr: string; nameAr: string };
  subject: { nameFr: string; nameAr: string };
  language: DocLanguage;
  schoolName: string;
};

const LANGUAGE_RULE: Record<DocLanguage, string> = {
  ar: "Rédige tout le document en arabe standard (فصحى) simple, adapté à l'âge des élèves, avec les termes utilisés dans les manuels tunisiens. Les nombres s'écrivent en chiffres arabes occidentaux (0-9), comme dans les manuels tunisiens.",
  fr: "Rédige tout le document en français, simple et adapté à des élèves tunisiens dont le français est la deuxième langue.",
  en: "Write the whole document in simple English suited to young Tunisian learners of English as a foreign language (CEFR pre-A1/A1).",
};

const DIFFICULTY: Record<ResourceRequest["difficulty"], string> = {
  easy: "facile (consolidation, pour tous les élèves)",
  medium: "moyen (niveau attendu de la classe)",
  hard: "difficile (approfondissement, pour les élèves avancés)",
};

function task(p: PromptInput): string {
  switch (p.kind) {
    case "LESSON":
      return `Prépare une fiche de préparation de séance (مذكرة) de ${p.duration} minutes.
Structure attendue :
1. En-tête : discipline, niveau, trimestre, thème, compétence visée, objectif de la séance (observable), prérequis, supports et matériel.
2. Déroulement sous forme de tableau Markdown avec les colonnes : étape, durée, activités de l'enseignant, activités des élèves, modalité (individuel, groupes, collectif). Étapes : mise en situation, découverte/recherche, mise en commun et synthèse, entraînement, évaluation formative. La somme des durées fait ${p.duration} minutes.
3. Trace écrite (le résumé que les élèves copient), encadrée par une citation Markdown.
4. Une petite évaluation formative de 2 ou 3 questions avec leurs réponses.
5. Remédiation : 2 ou 3 activités pour les élèves en difficulté, et un prolongement pour les plus rapides.`;
    case "EXERCISES":
      return `Prépare une série de ${p.count} exercices progressifs, du plus simple au plus difficile, niveau ${DIFFICULTY[p.difficulty]}.
Structure attendue :
1. Un titre et une consigne générale courte.
2. Les exercices numérotés, chacun avec une consigne claire et ce qu'il faut pour répondre (tableaux, pointillés « ........ » pour les réponses, listes).
3. Une section « Corrigé » séparée à la fin, avec les réponses de chaque exercice et, si utile, une courte explication pour l'enseignant.`;
    case "EXAM":
      return `Prépare une épreuve d'évaluation (فرض) de fin de module pour le trimestre ${p.term}, durée ${p.duration} minutes, notée sur 20.
Structure attendue :
1. En-tête à compléter par l'élève : nom et prénom, classe, date ; rappel de la durée.
2. Les exercices, regroupés selon les critères d'évaluation : critères minimaux C1, C2, C3 (environ 15 points au total) puis critère de perfectionnement C4 (environ 5 points). Indique pour chaque exercice le critère et le nombre de points.
3. Une grille récapitulative des critères (tableau Markdown : critère, exercices, points).
4. Une section « Corrigé et barème » séparée à la fin, détaillant les réponses et l'attribution des points.`;
  }
}

/** Consignes fixes (partagées par toutes les demandes). */
export function systemPrompt(): string {
  return `Tu es un conseiller pédagogique expérimenté de l'école primaire tunisienne. Tu aides les enseignants d'une école privée à préparer des documents prêts à imprimer et à utiliser en classe.

${PRIMARY_CONTEXT}

Règles de forme :
- Réponds uniquement avec le document, en Markdown (titres #, ##, listes, tableaux, gras). Pas d'introduction ni de conclusion qui s'adresse à l'enseignant hors du document.
- Le premier titre (#) est le titre du document.
- Pas d'images : si un dessin est utile, décris-le entre crochets pour que l'enseignant le dessine, par exemple [dessin : trois pommes].
- Contenu exact et vérifié : calculs justes, règles de grammaire correctes, faits historiques et géographiques sûrs.
- Contenu bienveillant, adapté aux enfants, sans stéréotype.`;
}

/** Demande précise de l'enseignant. */
export function userPrompt(p: PromptInput): string {
  const hint = LEVEL_HINTS[p.level.code] ?? "";
  return [
    `École : ${p.schoolName}`,
    `Niveau : ${p.level.nameFr} (${p.level.nameAr})${hint ? `\nRepère de niveau : ${hint}` : ""}`,
    `Matière : ${p.subject.nameFr} (${p.subject.nameAr})`,
    `Trimestre : ${p.term}`,
    `Thème ou leçon : ${p.topic}`,
    "",
    task(p),
    "",
    LANGUAGE_RULE[p.language],
    p.instructions ? `\nConsignes particulières de l'enseignant :\n${p.instructions}` : "",
  ]
    .join("\n")
    .trim();
}

/** Titre du document : premier titre Markdown, sinon un titre par défaut. */
export function extractTitle(markdown: string, fallback: string): string {
  const line = markdown.split("\n").find((l) => /^#\s+\S/.test(l));
  const title = line ? line.replace(/^#\s+/, "").replace(/[*_`]/g, "").trim() : "";
  return (title || fallback).slice(0, 160);
}

/** Demande de questions de défi (quiz) pour une classe. */
export function quizPrompt(p: { levelFr: string; levelCode: string; subjectFr: string; topic: string; count: number; language: DocLanguage }) {
  const hint = LEVEL_HINTS[p.levelCode] ?? "";
  return [
    `Niveau : ${p.levelFr}${hint ? ` (${hint})` : ""}`,
    `Matière : ${p.subjectFr}`,
    `Thème : ${p.topic}`,
    `Prépare ${p.count} questions à choix multiples, de difficulté progressive.`,
    LANGUAGE_RULE[p.language],
  ].join("\n");
}

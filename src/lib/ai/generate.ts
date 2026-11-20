import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt, userPrompt, type PromptInput } from "./prompt";

/** Modèle utilisé par l'atelier pédagogique. */
export const AI_MODEL = "claude-opus-5-5";

/** Vrai si la clé d'accès à l'IA est configurée sur le serveur. */
export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Nombre de documents par école et par mois (réglable avec AI_MONTHLY_LIMIT). */
export function monthlyLimit() {
  const n = Number(process.env.AI_MONTHLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

export type GenerateResult =
  | { ok: true; markdown: string }
  | { ok: false; reason: "refused" | "busy" | "unavailable" | "empty" };

let client: Anthropic | null = null;

/** Génère le document en Markdown. Ne lève pas d'erreur : renvoie la raison de l'échec. */
export async function generateResource(input: PromptInput): Promise<GenerateResult> {
  client ??= new Anthropic({ maxRetries: 2, timeout: 5 * 60 * 1000 });
  try {
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(input) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const markdown = message.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    if (!markdown) return { ok: false, reason: "empty" };
    return { ok: true, markdown };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { ok: false, reason: "busy" };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Atelier IA : erreur ${error.status}`, error.message);
      return { ok: false, reason: "unavailable" };
    }
    console.error("Atelier IA : erreur inattendue", error);
    return { ok: false, reason: "unavailable" };
  }
}

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          q: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: "integer" },
        },
        required: ["q", "choices", "answer"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export type QuizResult =
  | { ok: true; questions: { q: string; choices: string[]; answer: number }[] }
  | { ok: false; reason: "refused" | "busy" | "unavailable" | "empty" };

/** Propose des questions à choix multiples pour un défi de classe (JSON). */
export async function generateQuiz(prompt: string): Promise<QuizResult> {
  client ??= new Anthropic({ maxRetries: 2, timeout: 5 * 60 * 1000 });
  try {
    const message = await client.beta.messages
      .stream({
        model: AI_MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema: QUIZ_SCHEMA } },
        system:
          "Tu prépares des quiz courts et justes pour des élèves de l'école primaire tunisienne. Chaque question a 3 ou 4 choix courts, une seule bonne réponse (index à partir de 0), et des distracteurs plausibles. Varie la position de la bonne réponse.",
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = JSON.parse(text) as { questions?: { q: string; choices: string[]; answer: number }[] };
    const questions = (parsed.questions ?? []).filter(
      (q) => q.q && Array.isArray(q.choices) && q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length,
    );
    return questions.length ? { ok: true, questions: questions.map((q) => ({ ...q, choices: q.choices.slice(0, 4) })).filter((q) => q.answer < q.choices.length) } : { ok: false, reason: "empty" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    if (error instanceof SyntaxError) return { ok: false, reason: "empty" };
    console.error("Défi IA : erreur", error instanceof Anthropic.APIError ? error.status : error);
    return { ok: false, reason: "unavailable" };
  }
}

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

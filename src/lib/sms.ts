/**
 * Envoi de SMS (sans base de données, testable).
 *
 * Aucun fournisseur n'est imposé : on configure une adresse HTTP qui reçoit
 * { to, from, text } en JSON (format accepté par la plupart des passerelles
 * SMS, ou via un petit adaptateur). Sans configuration, rien n'est envoyé et
 * l'alerte est marquée « simulée » : on peut tout tester sans frais.
 */
export type SmsConfig = { url: string; token?: string; sender?: string };

export function smsConfigFromEnv(env: Record<string, string | undefined> = process.env): SmsConfig | null {
  return env.SMS_API_URL ? { url: env.SMS_API_URL, token: env.SMS_API_TOKEN, sender: env.SMS_SENDER } : null;
}

export type SendResult = { status: "SENT" | "SIMULATED" | "FAILED"; error?: string };

export async function sendSms(
  config: SmsConfig | null,
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!config) return { status: "SIMULATED" };
  try {
    const res = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({ to, from: config.sender, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? { status: "SENT" } : { status: "FAILED", error: `HTTP ${res.status}` };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 200) : "error" };
  }
}

/** Raccourcit un texte pour tenir dans un SMS (avec « … »). */
export function clip(text: string, max = 300): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

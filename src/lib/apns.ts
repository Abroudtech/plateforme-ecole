import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

/**
 * Notifications natives de l'application iPhone (service Apple « APNs »).
 *
 * Les appareils iPhone sont rangés avec les autres abonnements, avec une
 * adresse de la forme « apns:<jeton> » (voir APNS_PREFIX).
 *
 * Réglages sur Render (clé créée dans developer.apple.com > Keys, case
 * « Apple Push Notifications service ») :
 *   APNS_KEY     contenu du fichier .p8
 *   APNS_KEY_ID  identifiant de la clé (10 caractères)
 *   APPLE_TEAM_ID  identifiant de l'équipe Apple (10 caractères)
 *   APNS_TOPIC   identifiant de l'application (par défaut fr.abroudtech.ecole)
 *   APNS_SANDBOX=1 seulement pour une application lancée depuis Xcode
 */
export const APNS_PREFIX = "apns:";

export type ApnsConfig = { key: string; keyId: string; teamId: string; topic: string; host: string };

export function apnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const key = env.APNS_KEY?.replace(/\\n/g, "\n").trim();
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  if (!key || !keyId || !teamId) return null;
  return {
    key,
    keyId,
    teamId,
    topic: env.APNS_TOPIC?.trim() || "fr.abroudtech.ecole",
    host: env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com",
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Jeton d'accès signé (ES256) demandé par Apple ; valable une heure, on le refait toutes les 50 minutes. */
export function apnsJwt(cfg: Pick<ApnsConfig, "key" | "keyId" | "teamId">, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSeconds }));
  const data = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(data), { key: createPrivateKey(cfg.key), dsaEncoding: "ieee-p1363" });
  return `${data}.${b64url(signature)}`;
}

let cachedJwt: { token: string; at: number; keyId: string } | null = null;
function currentJwt(cfg: ApnsConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (!cachedJwt || cachedJwt.keyId !== cfg.keyId || now - cachedJwt.at > 50 * 60) {
    cachedJwt = { token: apnsJwt(cfg, now), at: now, keyId: cfg.keyId };
  }
  return cachedJwt.token;
}

export type ApnsMessage = { title: string; body: string; url: string; tag?: string };

export function apnsPayload(m: ApnsMessage) {
  return {
    aps: { alert: { title: m.title, body: m.body }, sound: "default", ...(m.tag ? { "thread-id": m.tag } : {}) },
    url: m.url,
  };
}

/** Jeton d'appareil valide : uniquement des caractères hexadécimaux. */
export const isApnsToken = (t: string) => /^[0-9a-f]{64,200}$/i.test(t);

/**
 * Envoie une notification à un iPhone. Renvoie "gone" si l'application a été
 * désinstallée (l'abonnement doit alors être oublié).
 */
export function sendApns(cfg: ApnsConfig, deviceToken: string, m: ApnsMessage): Promise<"ok" | "gone" | "error"> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: "ok" | "gone" | "error") => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };
    const client = connect(cfg.host);
    client.on("error", (e) => {
      console.error("APNs : connexion impossible", e);
      finish("error");
    });
    client.setTimeout(15_000, () => {
      client.close();
      finish("error");
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${currentJwt(cfg)}`,
      "apns-topic": cfg.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 3600),
    });
    let status = 0;
    let body = "";
    req.on("response", (h) => (status = Number(h[":status"])));
    req.setEncoding("utf8");
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      client.close();
      if (status === 200) return finish("ok");
      const reason = (() => {
        try {
          return (JSON.parse(body) as { reason?: string }).reason;
        } catch {
          return undefined;
        }
      })();
      if (status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") return finish("gone");
      console.error("APNs : échec d'envoi", status, reason);
      finish("error");
    });
    req.on("error", () => finish("error"));
    req.end(JSON.stringify(apnsPayload(m)));
  });
}

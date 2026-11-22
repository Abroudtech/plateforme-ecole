import { createHash, randomInt } from "node:crypto";

/** Code à 6 chiffres envoyé par SMS pour changer de mot de passe. */
export function newResetCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Empreinte du code (liée à la demande) : la base ne garde jamais le code lui-même. */
export function hashResetCode(resetId: string, code: string) {
  return createHash("sha256").update(`${resetId}:${code}`).digest("hex");
}

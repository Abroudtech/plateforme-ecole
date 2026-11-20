import { randomInt } from "node:crypto";

// Sans caractères faciles à confondre (0/O, 1/l/I), pour être dicté au téléphone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Mot de passe provisoire à communiquer au parent. */
export function generateTempPassword(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

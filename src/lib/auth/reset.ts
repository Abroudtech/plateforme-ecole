import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "./password";

export const CODE_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
/** Au plus 3 demandes par compte et par heure (contre les abus et les frais de SMS). */
export const MAX_REQUESTS_PER_HOUR = 3;

export { hashResetCode, newResetCode } from "./reset-code";

/** Change le mot de passe et ferme toutes les sessions ouvertes du compte. */
export async function setNewPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, isActive: true } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}

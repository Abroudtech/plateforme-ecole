import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Crée une session après une connexion réussie et pose le cookie. */
export async function createSession(
  userId: string,
  activeSchoolId: string | null,
  userAgent?: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      activeSchoolId,
      expiresAt,
      userAgent: userAgent?.slice(0, 255),
    },
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Retrouve la session du navigateur (ou null si absente / expirée). */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

/** Déconnexion : supprime la session en base et le cookie. */
export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function setActiveSchool(sessionId: string, schoolId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { activeSchoolId: schoolId },
  });
}

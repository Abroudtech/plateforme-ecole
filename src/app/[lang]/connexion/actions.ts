"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/phone";
import { isLocale } from "@/i18n/config";

export type LoginState = { error?: "invalid" | "missingFields" | "noAccess" | "tooMany" } | undefined;

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const schema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

// Empreinte factice : on vérifie quand même un mot de passe quand le compte
// n'existe pas, pour ne pas révéler (par le temps de réponse) qu'il n'existe pas.
const DUMMY_HASH = "$2b$12$ekw20eGheWBemN/WM1zaAuUsIk2T/5.XnWChQkxHVHXeftFXsYt6C";

export async function login(lang: string, _prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "missingFields" };

  const { identifier, password } = parsed.data;
  const where = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) ?? identifier };

  // Trop d'échecs récents pour cet identifiant : on bloque 15 minutes.
  const key = ("email" in where ? where.email : where.phone) ?? identifier;
  const failures = await db.loginAttempt.count({
    where: { identifier: key, success: false, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  if (failures >= MAX_FAILURES) return { error: "tooMany" };

  const user = await db.user.findUnique({
    where,
    include: { memberships: { where: { isActive: true, school: { isActive: true } } } },
  });

  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    await db.loginAttempt.create({ data: { identifier: key, success: false } });
    return { error: "invalid" };
  }
  await db.loginAttempt.deleteMany({ where: { identifier: key } });
  if (user.memberships.length === 0) return { error: "noAccess" };

  await createSession(user.id, user.memberships[0].schoolId, (await headers()).get("user-agent"));
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  // La langue préférée du compte prend le relais si l'adresse n'en a pas.
  const target = isLocale(lang) ? lang : user.preferredLocale;
  redirect(`/${target}/tableau-de-bord`);
}

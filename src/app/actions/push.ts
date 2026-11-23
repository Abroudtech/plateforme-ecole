"use server";

import { z } from "zod";
import { getOptionalContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { APNS_PREFIX, isApnsToken } from "@/lib/apns";

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Enregistre cet appareil pour recevoir les notifications du compte connecté. */
export async function subscribePush(raw: unknown): Promise<{ ok: boolean }> {
  const ctx = await getOptionalContext();
  if (!ctx) return { ok: false };
  const p = subSchema.safeParse(raw);
  if (!p.success || !p.data.endpoint.startsWith("https://")) return { ok: false };
  const { endpoint, keys } = p.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: ctx.user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: ctx.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: boolean }> {
  const ctx = await getOptionalContext();
  if (!ctx) return { ok: false };
  await db.pushSubscription.deleteMany({ where: { endpoint: String(endpoint).slice(0, 1000), userId: ctx.user.id } });
  return { ok: true };
}

/** Application iPhone : enregistre le jeton de notification donné par Apple. */
export async function subscribeNativePush(token: unknown): Promise<{ ok: boolean }> {
  const ctx = await getOptionalContext();
  if (!ctx || typeof token !== "string" || !isApnsToken(token)) return { ok: false };
  const endpoint = APNS_PREFIX + token.toLowerCase();
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: ctx.user.id },
    create: { userId: ctx.user.id, endpoint, p256dh: "", auth: "" },
  });
  return { ok: true };
}

export async function unsubscribeNativePush(token: unknown): Promise<{ ok: boolean }> {
  const ctx = await getOptionalContext();
  if (!ctx || typeof token !== "string" || !isApnsToken(token)) return { ok: false };
  await db.pushSubscription.deleteMany({ where: { endpoint: APNS_PREFIX + token.toLowerCase(), userId: ctx.user.id } });
  return { ok: true };
}

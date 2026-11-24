import "server-only";
import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { APNS_PREFIX, apnsConfig, sendApns } from "@/lib/apns";

/**
 * Notifications sur le téléphone (Web Push). Les clés sont créées
 * automatiquement la première fois et gardées dans la base : rien à configurer.
 */
type Keys = { publicKey: string; privateKey: string };
let cached: Keys | null = null;

export async function vapidKeys(): Promise<Keys> {
  if (cached) return cached;
  const row = await db.platformSetting.findUnique({ where: { key: "vapid" } });
  if (row) return (cached = JSON.parse(row.value) as Keys);
  const keys = webpush.generateVAPIDKeys();
  try {
    await db.platformSetting.create({ data: { key: "vapid", value: JSON.stringify(keys) } });
    return (cached = keys);
  } catch (e) {
    // Créées en même temps par une autre requête : on relit.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.platformSetting.findUniqueOrThrow({ where: { key: "vapid" } });
      return (cached = JSON.parse(again.value) as Keys);
    }
    throw e;
  }
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Envoie une notification à tous les appareils des comptes donnés. Ne lève jamais d'erreur. */
export async function sendPush(userIds: string[], message: PushMessage | ((userId: string) => PushMessage)) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (subs.length === 0) return;
    const keys = await vapidKeys();
    const contact = process.env.PUSH_CONTACT ?? "mailto:contact@example.com";
    const apns = apnsConfig();
    await Promise.all(
      subs.map(async (s) => {
        const m = typeof message === "function" ? message(s.userId) : message;
        // Application iPhone : notification native Apple.
        if (s.endpoint.startsWith(APNS_PREFIX)) {
          if (!apns) return;
          const r = await sendApns(apns, s.endpoint.slice(APNS_PREFIX.length), m);
          if (r === "gone") await db.pushSubscription.deleteMany({ where: { id: s.id } });
          return;
        }
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(m),
            { vapidDetails: { subject: contact, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 24 * 3600 },
          );
        } catch (e) {
          // Appareil désinstallé ou abonnement expiré : on l'oublie.
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.pushSubscription.deleteMany({ where: { id: s.id } });
          else console.error("Notification : échec d'envoi", status ?? e);
        }
      }),
    );
  } catch (e) {
    console.error("Notification : erreur", e);
  }
}

/** Comptes de la direction d'une école (pour les prévenir d'un message de parent...). */
export async function schoolAdminIds(schoolId: string) {
  const m = await db.membership.findMany({ where: { schoolId, role: "ADMIN", isActive: true }, select: { userId: true } });
  return m.map((x) => x.userId);
}

import "server-only";
import { db } from "@/lib/db";
import { monthlyLimit } from "./generate";

/** Début du mois en cours (heure de Tunis, à quelques heures près). */
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Utilisations de l'IA ce mois-ci pour l'école : documents de l'atelier et
 * autres demandes (questions de défi...). Une seule limite pour tout.
 */
export async function aiUsedThisMonth(schoolId: string) {
  const since = monthStart();
  const [resources, requests] = await Promise.all([
    db.teachingResource.count({ where: { schoolId, createdAt: { gte: since } } }),
    db.aiRequest.count({ where: { schoolId, createdAt: { gte: since } } }),
  ]);
  return resources + requests;
}

export async function aiQuotaReached(schoolId: string) {
  return (await aiUsedThisMonth(schoolId)) >= monthlyLimit();
}

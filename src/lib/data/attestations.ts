import "server-only";
import { db } from "@/lib/db";

/** Logo de l'école (réglé dans « Site de l'école »), pour l'en-tête des attestations. */
export async function schoolLogoUrl(schoolId: string): Promise<string | null> {
  const logo = await db.sitePhoto.findFirst({ where: { schoolId, kind: "LOGO" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return logo ? `/api/vitrine/photo/${logo.id}` : null;
}

import { db } from "@/lib/db";

/** Vérification de bon fonctionnement (utilisée par l'hébergeur et Docker). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

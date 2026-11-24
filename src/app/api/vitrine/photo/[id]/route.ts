import { getOptionalContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

/**
 * Photo de la page vitrine. Publique quand la page est publiée ; sinon,
 * visible seulement par la direction de l'école (aperçu).
 * Une photo ne change jamais (la remplacer crée une nouvelle photo) : on
 * laisse le navigateur la garder en cache.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/vitrine/photo/[id]">) {
  const { id } = await params;
  const photo = await db.sitePhoto.findUnique({
    where: { id },
    select: { data: true, mimeType: true, schoolId: true, school: { select: { isActive: true, site: { select: { published: true } } } } },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  const isPublic = photo.school.isActive && !!photo.school.site?.published;
  if (!isPublic) {
    const ctx = await getOptionalContext();
    if (ctx?.school?.id !== photo.schoolId || !can(ctx.roles, "site.write")) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": isPublic ? "public, max-age=604800, immutable" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

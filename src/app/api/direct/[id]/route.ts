import { getOptionalContext } from "@/lib/auth/context";
import { liveState } from "@/lib/data/live";

export const dynamic = "force-dynamic";

/** État du défi en direct, lu chaque seconde par l'écran de la classe et les téléphones des élèves. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOptionalContext();
  if (!ctx?.school) return Response.json({ error: "auth" }, { status: 401 });
  const { id } = await params;
  const lang = new URL(request.url).searchParams.get("lang") === "ar" ? "ar" : "fr";
  const state = await liveState({ ...ctx, school: ctx.school }, id, lang);
  if (!state) return Response.json({ error: "notFound" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

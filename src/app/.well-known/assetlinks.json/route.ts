import { assetLinks } from "@/lib/mobile/config";

// Lu par les téléphones Android à l'installation de l'application.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinks(), { headers: { "Cache-Control": "public, max-age=3600" } });
}

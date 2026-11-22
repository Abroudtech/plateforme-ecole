import { isLocale } from "@/i18n/config";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

/** Fichier d'un justificatif : visible par la direction et par le parent qui l'a envoyé. */
export async function GET(_request: Request, { params }: RouteContext<"/[lang]/justificatifs/[noteId]">) {
  const { lang: raw, noteId } = await params;
  const lang = isLocale(raw) ? raw : "fr";
  const ctx = await requireContext(lang);
  const note = await db.absenceNote.findFirst({ where: { id: noteId, schoolId: ctx.school.id } });
  if (!note || !note.fileData || !note.fileType) return new Response("Not found", { status: 404 });
  if (!can(ctx.roles, "attendance.justify") && note.authorId !== ctx.user.id) return new Response("Forbidden", { status: 403 });
  return new Response(new Uint8Array(note.fileData), {
    headers: {
      "Content-Type": note.fileType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

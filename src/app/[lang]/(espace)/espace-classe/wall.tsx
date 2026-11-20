import { Pin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { REACTIONS } from "@/lib/challenges";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { Card, Textarea } from "@/components/ui";
import { createPost, deletePost, react, reviewPost, togglePin } from "./actions";

/**
 * Mur de la classe. L'enseignant publie et valide ; l'élève propose un message
 * (visible par tous seulement après validation) et réagit avec un émoji.
 */
export async function Wall({
  schoolId,
  classId,
  userId,
  manage,
  lang,
  dict,
}: {
  schoolId: string;
  classId: string;
  userId: string;
  manage: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const cs = dict.classSpace;
  const posts = await db.classPost.findMany({
    where: {
      schoolId,
      classGroupId: classId,
      // L'élève voit les messages publiés et ses propres messages en attente.
      OR: manage ? [{ status: { in: ["PUBLISHED", "PENDING"] } }] : [{ status: "PUBLISHED" }, { authorId: userId, status: "PENDING" }],
    },
    include: { author: { include: { memberships: { where: { schoolId }, select: { role: true } } } }, reactions: true },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  const pending = posts.filter((p) => p.status === "PENDING");
  const published = posts.filter((p) => p.status === "PUBLISHED");
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" });
  // Petits boutons : pas de message « Enregistré » après chaque clic.
  const btn = (label: string) => ({ ...formLabels(dict, label), saved: undefined });
  const isStaff = (p: (typeof posts)[number]) => p.author.memberships.some((m) => m.role !== "STUDENT");

  return (
    <div className="flex flex-col gap-4">
      <Card title={manage ? cs.newPost : cs.proposePost}>
        {!manage && <p className="mb-3 text-sm text-slate-600">{cs.studentPostHelp}</p>}
        <ActionForm action={createPost.bind(null, lang, classId)} labels={formLabels(dict, manage ? cs.publish : cs.send)} resetOnSuccess>
          <Textarea name="body" required maxLength={1000} placeholder={manage ? cs.postPlaceholder : cs.studentPlaceholder} />
        </ActionForm>
      </Card>

      {manage && pending.length > 0 && (
        <Card title={`${cs.toReview} (${pending.length})`} className="ring-gold-300">
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <li key={p.id} className="rounded-xl bg-gold-50 p-3">
                <p className="text-xs font-semibold text-slate-600">{personName(p.author, lang)} · {fmt.format(p.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line" dir="auto">{p.body}</p>
                <div className="mt-2 flex gap-2">
                  <ActionForm action={reviewPost.bind(null, lang, p.id, true)} labels={btn(cs.approve)} className="contents" />
                  <ActionForm action={reviewPost.bind(null, lang, p.id, false)} labels={btn(cs.reject)} variant="danger" className="contents" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!manage && pending.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.id} className="rounded-2xl bg-gold-50 p-3 text-sm ring-1 ring-gold-200">
              <p className="text-xs font-semibold text-gold-800">{cs.waiting}</p>
              <p className="mt-1 whitespace-pre-line" dir="auto">{p.body}</p>
            </li>
          ))}
        </ul>
      )}

      {published.length === 0 ? (
        <p className="text-sm text-slate-500">{cs.noPosts}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {published.map((p) => {
            const mine = p.reactions.find((r) => r.userId === userId)?.emoji;
            const counts = REACTIONS.map((e) => [e, p.reactions.filter((r) => r.emoji === e).length] as const);
            return (
              <li key={p.id} className={`rounded-2xl bg-white p-4 shadow-card ring-1 ${p.isPinned ? "ring-gold-400" : "ring-slate-200/80"}`}>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${isStaff(p) ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {personName(p.author, lang)}
                  </span>
                  <span>{fmt.format(p.createdAt)}</span>
                  {p.isPinned && <Pin size={14} className="text-gold-600" aria-label={cs.pinned} />}
                </div>
                <p className="mt-2 whitespace-pre-line" dir="auto">{p.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {counts.map(([emoji, n]) => (
                    <ActionForm
                      key={emoji}
                      action={react.bind(null, lang, p.id, emoji)}
                      labels={{ ...btn(n ? `${emoji} ${n}` : emoji), pending: "…" }}
                      variant={mine === emoji ? "primary" : "secondary"}
                      className="contents"
                    />
                  ))}
                  {manage && (
                    <span className="ms-auto flex gap-1.5">
                      <ActionForm action={togglePin.bind(null, lang, p.id)} labels={btn(p.isPinned ? cs.unpin : cs.pin)} variant="secondary" className="contents" />
                      <ActionForm action={deletePost.bind(null, lang, p.id)} labels={btn(dict.common.remove)} variant="danger" confirm={`${dict.common.remove} ?`} className="contents" />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

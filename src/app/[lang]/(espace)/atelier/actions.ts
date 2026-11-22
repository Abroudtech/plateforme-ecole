"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { aiEnabled, generateResource } from "@/lib/ai/generate";
import { aiQuotaReached } from "@/lib/ai/quota";
import { subjectLanguage } from "@/lib/ai/programme-primaire";
import { extractTitle, resourceRequestSchema } from "@/lib/ai/prompt";
import { FormError } from "@/lib/forms";

export async function createResource(lang: string, _prev: FormState, formData: FormData) {
  let id: string | null = null;
  const state = await runAction(lang, "ai.use", async (ctx) => {
    if (!aiEnabled()) throw new FormError("aiDisabled");
    const schoolId = ctx.school.id;
    const req = parseForm(resourceRequestSchema, formData);
    const [level, subject] = await Promise.all([
      db.gradeLevel.findFirst({ where: { id: req.gradeLevelId, schoolId } }),
      db.subject.findFirst({ where: { id: req.subjectId, schoolId } }),
    ]);
    if (!level || !subject) throw new FormError("invalid");

    if (await aiQuotaReached(schoolId)) throw new FormError("aiQuota");

    const language = subjectLanguage(subject);
    const result = await generateResource({
      ...req,
      level,
      subject,
      language,
      schoolName: ctx.school.nameFr,
    });
    if (!result.ok) {
      throw new FormError({ refused: "aiRefused", busy: "aiBusy", unavailable: "aiUnavailable", empty: "aiUnavailable" }[result.reason]);
    }

    const created = await db.teachingResource.create({
      data: {
        schoolId,
        authorId: ctx.user.id,
        kind: req.kind,
        gradeLevelId: level.id,
        subjectId: subject.id,
        topic: req.topic,
        title: extractTitle(result.markdown, req.topic),
        language,
        content: result.markdown,
        request: req,
      },
    });
    id = created.id;
  });
  if (id) redirect(`/${lang}/atelier/${id}`);
  return state;
}

export async function deleteResource(lang: string, resourceId: string, _prev: FormState, _fd: FormData) {
  let done = false;
  const state = await runAction(lang, "ai.use", async (ctx) => {
    const r = await db.teachingResource.findFirst({ where: { id: resourceId, schoolId: ctx.school.id } });
    if (!r) throw new FormError("notFound");
    // L'auteur supprime ses documents ; la direction peut tout supprimer.
    if (r.authorId !== ctx.user.id && !ctx.roles.includes("ADMIN")) throw new FormError("forbidden");
    await db.teachingResource.delete({ where: { id: r.id } });
    done = true;
  });
  if (done) redirect(`/${lang}/atelier`);
  return state;
}

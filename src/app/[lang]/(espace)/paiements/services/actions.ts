"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { parseForm, runAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";

async function serviceOrFail(schoolId: string, feeId: string) {
  const fee = await db.fee.findFirst({ where: { id: feeId, schoolId, isOptional: true } });
  if (!fee) throw new FormError("notFound");
  return fee;
}

/** Inscrit un élève (ou toute une classe) à un service : cantine, transport, activité. */
export async function addToService(lang: string, feeId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const data = parseForm(z.object({ studentId: z.string().optional(), classGroupId: z.string().optional() }), formData);
    const schoolId = ctx.school.id;
    const fee = await serviceOrFail(schoolId, feeId);
    let ids: string[] = [];
    if (data.classGroupId) {
      const enrollments = await db.enrollment.findMany({
        where: { schoolId, classGroupId: data.classGroupId, status: "ACTIVE", academicYearId: fee.academicYearId },
        select: { studentId: true },
      });
      ids = enrollments.map((e) => e.studentId);
    } else if (data.studentId) {
      const s = await db.student.findFirst({ where: { id: data.studentId, schoolId } });
      if (!s) throw new FormError("notFound");
      ids = [s.id];
    }
    if (ids.length === 0) throw new FormError("invalid");
    await db.studentFee.createMany({ data: ids.map((studentId) => ({ schoolId, studentId, feeId })), skipDuplicates: true });
    refresh();
  });
}

/** Information utile pour la liste : arrêt du bus, allergie, groupe... */
export async function setServiceInfo(lang: string, feeId: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const { info } = parseForm(z.object({ info: z.string().trim().max(200).optional() }), formData);
    await serviceOrFail(ctx.school.id, feeId);
    await db.studentFee.updateMany({ where: { schoolId: ctx.school.id, feeId, studentId }, data: { serviceInfo: info || null } });
    refresh();
  });
}

export async function removeFromService(lang: string, feeId: string, studentId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    await serviceOrFail(ctx.school.id, feeId);
    await db.studentFee.deleteMany({ where: { schoolId: ctx.school.id, feeId, studentId } });
    refresh();
  });
}

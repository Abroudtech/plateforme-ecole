"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { parseISODate, todayISO } from "@/lib/dates";
import { getCurrentYear } from "@/lib/data/school";
import { getPrimaryGuardian, getStudentAccount } from "@/lib/data/payments";
import { FormError, optionalText, requiredText } from "@/lib/forms";
import { formatMoney, parseAmount, whatsappLink } from "@/lib/payments";

async function currentYearOrFail(schoolId: string) {
  const year = await getCurrentYear(schoolId);
  if (!year) throw new FormError("noYear");
  return year;
}

function amountOrFail(value: string | null | undefined, allowZero = false) {
  const amount = parseAmount(value);
  if (amount == null || (!allowZero && amount === 0)) throw new FormError("amountInvalid");
  return amount;
}

function dateOrFail(value: string | null | undefined) {
  const d = parseISODate(value);
  if (!d) throw new FormError("dateInvalid");
  return d;
}

async function studentOrFail(schoolId: string, studentId: string) {
  const s = await db.student.findFirst({ where: { id: studentId, schoolId } });
  if (!s) throw new FormError("notFound");
  return s;
}

// ---------------------------------------------------------------------------
// Frais de l'année
// ---------------------------------------------------------------------------

const feeSchema = z.object({
  name: requiredText,
  nameAr: optionalText,
  amount: z.string(),
  dueDate: z.string(),
  gradeLevelId: z.string().optional(),
  isOptional: z.string().optional(),
});

export async function saveFee(lang: string, feeId: string | null, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const data = parseForm(feeSchema, formData);
    const year = await currentYearOrFail(ctx.school.id);
    const gradeLevelId = data.gradeLevelId || null;
    if (gradeLevelId && !(await db.gradeLevel.findFirst({ where: { id: gradeLevelId, schoolId: ctx.school.id } }))) {
      throw new FormError("notFound");
    }
    const fields = {
      name: data.name,
      nameAr: data.nameAr,
      amountMillimes: amountOrFail(data.amount),
      dueDate: dateOrFail(data.dueDate),
      gradeLevelId,
      isOptional: data.isOptional === "on",
    };
    if (feeId) {
      const n = await db.fee.updateMany({ where: { id: feeId, schoolId: ctx.school.id }, data: fields });
      if (n.count === 0) throw new FormError("notFound");
    } else {
      await db.fee.create({ data: { ...fields, schoolId: ctx.school.id, academicYearId: year.id } });
    }
    refresh();
  });
}

export async function deleteFee(lang: string, feeId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    await db.fee.deleteMany({ where: { id: feeId, schoolId: ctx.school.id } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Frais d'un élève : services optionnels et montants personnalisés
// ---------------------------------------------------------------------------

export async function addStudentFee(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const { feeId } = parseForm(z.object({ feeId: z.string().min(1) }), formData);
    await studentOrFail(ctx.school.id, studentId);
    const fee = await db.fee.findFirst({ where: { id: feeId, schoolId: ctx.school.id } });
    if (!fee) throw new FormError("notFound");
    await db.studentFee.upsert({
      where: { studentId_feeId: { studentId, feeId } },
      update: {},
      create: { schoolId: ctx.school.id, studentId, feeId },
    });
    refresh();
  });
}

/** Montant personnalisé (réduction, exonération) ; vide = montant normal. */
export async function setStudentFeeAmount(lang: string, studentId: string, feeId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const data = parseForm(z.object({ amount: z.string().optional(), note: optionalText }), formData);
    await studentOrFail(ctx.school.id, studentId);
    const fee = await db.fee.findFirst({ where: { id: feeId, schoolId: ctx.school.id } });
    if (!fee) throw new FormError("notFound");
    const amountMillimes = data.amount?.trim() ? amountOrFail(data.amount, true) : null;
    if (amountMillimes == null && !fee.isOptional) {
      await db.studentFee.deleteMany({ where: { studentId, feeId } });
    } else {
      await db.studentFee.upsert({
        where: { studentId_feeId: { studentId, feeId } },
        update: { amountMillimes, note: data.note },
        create: { schoolId: ctx.school.id, studentId, feeId, amountMillimes, note: data.note },
      });
    }
    refresh();
  });
}

/** Désinscrit l'élève d'un service optionnel. */
export async function removeStudentFee(lang: string, studentId: string, feeId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    await db.studentFee.deleteMany({ where: { schoolId: ctx.school.id, studentId, feeId } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Encaissements
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.string(),
  method: z.enum(["CASH", "CHECK", "TRANSFER", "CARD", "OTHER"]),
  paidAt: z.string(),
  reference: optionalText,
  note: optionalText,
});

export async function recordPayment(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx, l) => {
    const data = parseForm(paymentSchema, formData);
    await studentOrFail(ctx.school.id, studentId);
    const year = await currentYearOrFail(ctx.school.id);
    const amountMillimes = amountOrFail(data.amount);
    const paidAt = dateOrFail(data.paidAt);
    if (data.paidAt > todayISO()) throw new FormError("dateFuture");
    if (data.method === "CHECK" && !data.reference) throw new FormError("checkNumber");

    // Numéro de reçu : le suivant dans l'école. En cas d'enregistrement
    // simultané, la contrainte d'unicité fait échouer l'un des deux : on réessaie.
    let paymentId = "";
    for (let attempt = 0; attempt < 3 && !paymentId; attempt++) {
      try {
        paymentId = await db.$transaction(async (tx) => {
          const last = await tx.payment.aggregate({ where: { schoolId: ctx.school.id }, _max: { receiptNumber: true } });
          const p = await tx.payment.create({
            data: {
              schoolId: ctx.school.id,
              studentId,
              academicYearId: year.id,
              receiptNumber: (last._max.receiptNumber ?? 0) + 1,
              amountMillimes,
              method: data.method,
              reference: data.reference,
              note: data.note,
              paidAt,
              createdById: ctx.user.id,
            },
          });
          return p.id;
        });
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    redirect(`/${l}/paiements/recus/${paymentId}`);
  });
}

export async function cancelPayment(lang: string, paymentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "payments.write", async (ctx) => {
    const { reason } = parseForm(z.object({ reason: requiredText }), formData);
    const n = await db.payment.updateMany({
      where: { id: paymentId, schoolId: ctx.school.id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelReason: reason },
    });
    if (n.count === 0) throw new FormError("notFound");
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Relances
// ---------------------------------------------------------------------------

export async function sendReminder(
  lang: string,
  studentId: string,
  channel: "WHATSAPP" | "LETTER" | "CALL",
  _prev: FormState,
  _fd: FormData,
) {
  return runAction(lang, "payments.write", async (ctx, l) => {
    const student = await studentOrFail(ctx.school.id, studentId);
    const year = await currentYearOrFail(ctx.school.id);
    const data = await getStudentAccount(ctx.school.id, studentId, year.id, todayISO());
    if (!data || data.account.overdue === 0) throw new FormError("nothingOverdue");
    const amount = data.account.overdue;

    let target: string | null = null;
    if (channel === "WHATSAPP") {
      const guardian = await getPrimaryGuardian(ctx.school.id, studentId);
      const phone = guardian?.whatsapp ?? guardian?.phone;
      if (!guardian || !phone) throw new FormError("noGuardianPhone");
      // Message en arabe puis en français, quel que soit la langue de l'écran.
      const [ar, fr] = await Promise.all([getDictionary("ar"), getDictionary("fr")]);
      const text = (d: typeof fr, lg: "fr" | "ar") =>
        t(d.payments.reminderText, {
          parent: lg === "ar" && guardian.firstNameAr ? guardian.firstNameAr : guardian.firstName,
          student: lg === "ar" && student.firstNameAr ? student.firstNameAr : student.firstName,
          amount: formatMoney(amount, lg),
          school: lg === "ar" ? ctx.school.nameAr : ctx.school.nameFr,
        });
      target = whatsappLink(phone, `${text(ar, "ar")}\n\n${text(fr, "fr")}`);
    } else if (channel === "LETTER") {
      target = `/${l}/eleves/${studentId}/paiements/relance`;
    }

    await db.paymentReminder.create({
      data: { schoolId: ctx.school.id, studentId, channel, amountMillimes: amount, createdById: ctx.user.id },
    });
    if (target) redirect(target);
    refresh();
  });
}

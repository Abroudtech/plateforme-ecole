"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { getCurrentYear } from "@/lib/data/school";
import { nextStudentNumber } from "@/lib/data/students";
import { FormError, optionalText, requiredText } from "@/lib/forms";
import { normalizePhone } from "@/lib/phone";
import { studentUsername } from "@/lib/student/username";

// ---------------------------------------------------------------------------
// Schémas de validation
// ---------------------------------------------------------------------------

const identitySchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  gender: z.enum(["MALE", "FEMALE", ""]).optional().transform((v) => (v ? v : null)),
  birthDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime())),
  birthPlace: optionalText,
  studentNumber: z.string().trim().max(30).optional().transform((v) => (v ? v : null)),
});

const phoneField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  });

const emailField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .pipe(z.email().nullable());

const guardianSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  phone: phoneField,
  whatsapp: phoneField,
  email: emailField,
  relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]),
  isPrimary: z.string().optional().transform((v) => v === "on"),
});

/** Lit les champs préfixés (par ex. "guardian.firstName") d'un formulaire. */
function subForm(formData: FormData, prefix: string): FormData {
  const out = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix)) out.set(key.slice(prefix.length), value);
  }
  return out;
}

function parseGuardian(formData: FormData) {
  const r = guardianSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) {
    const phoneIssue = r.error.issues.some((i) => i.message === "phoneInvalid");
    throw new FormError(phoneIssue ? "phoneInvalid" : "invalid");
  }
  return r.data;
}

// ---------------------------------------------------------------------------
// Vérifications "même école"
// ---------------------------------------------------------------------------

async function findStudent(schoolId: string, id: string) {
  const s = await db.student.findFirst({ where: { schoolId, id } });
  if (!s) throw new FormError("notFound");
  return s;
}

/** La classe doit appartenir à l'école et à l'année en cours. */
async function findCurrentClass(schoolId: string, classGroupId: string, academicYearId: string) {
  const c = await db.classGroup.findFirst({ where: { schoolId, id: classGroupId, academicYearId } });
  if (!c) throw new FormError("invalid");
  return c;
}

/**
 * Retrouve un parent déjà connu de l'école (même téléphone ou même e-mail),
 * pour éviter les doublons entre frères et sœurs.
 */
async function findExistingGuardian(schoolId: string, phone: string | null, email: string | null) {
  const or = [phone ? { phone } : null, email ? { email } : null].filter((x) => x !== null);
  if (or.length === 0) return null;
  return db.guardian.findFirst({ where: { schoolId, OR: or } });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Crée un élève, l'inscrit dans une classe et enregistre un premier parent. */
export async function createStudent(lang: string, _prev: FormState, formData: FormData) {
  return runAction(
    lang,
    "students.write",
    async (ctx, l) => {
      const schoolId = ctx.school.id;
      const data = parseForm(identitySchema, formData);
      const classGroupId = String(formData.get("classGroupId") ?? "");
      const guardianForm = subForm(formData, "guardian.");
      const withGuardian = String(guardianForm.get("firstName") ?? "").trim() !== "";
      const guardian = withGuardian ? parseGuardian(guardianForm) : null;

      const year = await getCurrentYear(schoolId);
      if (classGroupId && !year) throw new FormError("noYear");
      const cls = classGroupId && year ? await findCurrentClass(schoolId, classGroupId, year.id) : null;

      const prefix = year ? year.label.slice(0, 4) : String(new Date().getFullYear());
      const studentNumber = data.studentNumber ?? (await nextStudentNumber(schoolId, prefix));

      const student = await db.$transaction(async (tx) => {
        const s = await tx.student.create({ data: { ...data, studentNumber, schoolId } });
        if (cls && year) {
          await tx.enrollment.create({
            data: { schoolId, studentId: s.id, academicYearId: year.id, classGroupId: cls.id },
          });
        }
        if (guardian) {
          const { relationship, isPrimary: _ignored, ...g } = guardian;
          const existing = await findExistingGuardian(schoolId, g.phone, g.email);
          const guardianId = existing?.id ?? (await tx.guardian.create({ data: { ...g, schoolId } })).id;
          await tx.studentGuardian.create({
            data: { studentId: s.id, guardianId, relationship, isPrimary: true },
          });
        }
        return s;
      });

      redirect(`/${l}/eleves/${student.id}`);
    },
    "duplicateNumber",
  );
}

/** Modifie l'identité d'un élève. */
export async function updateStudent(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(
    lang,
    "students.write",
    async (ctx) => {
      const student = await findStudent(ctx.school.id, studentId);
      const data = parseForm(identitySchema, formData);
      await db.student.update({
        where: { id: student.id },
        data: { ...data, studentNumber: data.studentNumber ?? student.studentNumber },
      });
      refresh();
    },
    "duplicateNumber",
  );
}

/** Inscrit l'élève dans une classe de l'année en cours (ou le désinscrit). */
export async function setEnrollment(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const student = await findStudent(schoolId, studentId);
    const year = await getCurrentYear(schoolId);
    if (!year) throw new FormError("noYear");
    const classGroupId = String(formData.get("classGroupId") ?? "");

    if (!classGroupId) {
      await db.enrollment.deleteMany({ where: { schoolId, studentId: student.id, academicYearId: year.id } });
    } else {
      const cls = await findCurrentClass(schoolId, classGroupId, year.id);
      await db.enrollment.upsert({
        where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
        update: { classGroupId: cls.id, status: "ACTIVE" },
        create: { schoolId, studentId: student.id, academicYearId: year.id, classGroupId: cls.id },
      });
    }
    refresh();
  });
}

/** Retire un élève de l'école (ou le réinscrit). L'historique est conservé. */
export async function setStudentActive(lang: string, studentId: string, active: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const student = await findStudent(schoolId, studentId);
    const year = await getCurrentYear(schoolId);
    await db.$transaction([
      db.student.update({ where: { id: student.id }, data: { isActive: active } }),
      db.enrollment.updateMany({
        where: { schoolId, studentId: student.id, academicYearId: year?.id ?? "__aucune__" },
        data: { status: active ? "ACTIVE" : "WITHDRAWN" },
      }),
    ]);
    refresh();
  });
}

/** Ajoute un parent ou tuteur à l'élève (réutilise un parent déjà connu). */
export async function addGuardian(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const student = await findStudent(schoolId, studentId);
    const { relationship, isPrimary, ...g } = parseGuardian(formData);

    const existing = await findExistingGuardian(schoolId, g.phone, g.email);
    await db.$transaction(async (tx) => {
      const guardianId = existing?.id ?? (await tx.guardian.create({ data: { ...g, schoolId } })).id;
      if (isPrimary) {
        await tx.studentGuardian.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
      }
      await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId } },
        update: { relationship, isPrimary },
        create: { studentId: student.id, guardianId, relationship, isPrimary },
      });
    });
    refresh();
  });
}

/** Modifie les coordonnées d'un parent. */
export async function updateGuardian(lang: string, studentId: string, guardianId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const link = await db.studentGuardian.findFirst({
      where: { studentId, guardianId, student: { schoolId }, guardian: { schoolId } },
    });
    if (!link) throw new FormError("notFound");
    const { relationship, isPrimary, ...g } = parseGuardian(formData);
    await db.$transaction(async (tx) => {
      await tx.guardian.update({ where: { id: guardianId }, data: g });
      if (isPrimary) {
        await tx.studentGuardian.updateMany({ where: { studentId }, data: { isPrimary: false } });
      }
      await tx.studentGuardian.update({
        where: { studentId_guardianId: { studentId, guardianId } },
        data: { relationship, isPrimary },
      });
    });
    refresh();
  });
}

/** Retire le lien entre un élève et un parent (le parent reste connu de l'école). */
export async function unlinkGuardian(lang: string, studentId: string, guardianId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    await db.studentGuardian.deleteMany({
      where: { studentId, guardianId, student: { schoolId: ctx.school.id } },
    });
    refresh();
  });
}

/**
 * Crée l'accès à l'application pour un parent, ou lui donne un nouveau mot
 * de passe provisoire. Le mot de passe est affiché une seule fois.
 */
export async function createGuardianAccess(lang: string, guardianId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const guardian = await db.guardian.findFirst({ where: { id: guardianId, schoolId } });
    if (!guardian) throw new FormError("notFound");
    if (!guardian.phone && !guardian.email) throw new FormError("contactRequired");

    // Compte déjà relié, ou compte existant avec le même téléphone / e-mail
    // (par exemple un parent déjà inscrit dans une autre école).
    const or = [guardian.phone ? { phone: guardian.phone } : null, guardian.email ? { email: guardian.email } : null].filter(
      (x) => x !== null,
    );
    const user =
      (guardian.userId && (await db.user.findUnique({ where: { id: guardian.userId }, include: { memberships: true } }))) ||
      (await db.user.findFirst({ where: { OR: or }, include: { memberships: true } }));

    // Par sécurité, on ne touche jamais au mot de passe d'un compte du personnel.
    if (user && (user.isPlatformAdmin || user.memberships.some((m) => m.role !== "PARENT"))) {
      throw new FormError("accountConflict");
    }

    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    await db.$transaction(async (tx) => {
      const account = user
        ? await tx.user.update({ where: { id: user.id }, data: { passwordHash, isActive: true } })
        : await tx.user.create({
            data: {
              phone: guardian.phone,
              email: guardian.email,
              passwordHash,
              firstName: guardian.firstName,
              lastName: guardian.lastName,
              firstNameAr: guardian.firstNameAr,
              lastNameAr: guardian.lastNameAr,
              preferredLocale: ctx.school.defaultLocale,
            },
          });
      if (user) {
        // Le mot de passe change : on déconnecte les anciennes sessions.
        await tx.session.deleteMany({ where: { userId: account.id } });
      }
      await tx.guardian.update({ where: { id: guardian.id }, data: { userId: account.id } });
      await tx.membership.upsert({
        where: { userId_schoolId_role: { userId: account.id, schoolId, role: "PARENT" } },
        update: { isActive: true },
        create: { userId: account.id, schoolId, role: "PARENT" },
      });
    });

    return {
      ok: true,
      credentials: { login: guardian.phone ? guardian.phone.replace(/^\+216/, "") : guardian.email!, password },
    };
  });
}

/**
 * Accès de l'élève à son espace (défis, jeux, mur de la classe). L'élève se
 * connecte avec un identifiant « prenom.matricule » et un mot de passe provisoire.
 */
export async function createStudentAccess(lang: string, studentId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const student = await db.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student) throw new FormError("notFound");

    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    const username = await db.$transaction(async (tx) => {
      if (student.userId) {
        const user = await tx.user.update({ where: { id: student.userId }, data: { passwordHash, isActive: true } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.membership.upsert({
          where: { userId_schoolId_role: { userId: user.id, schoolId, role: "STUDENT" } },
          update: { isActive: true },
          create: { userId: user.id, schoolId, role: "STUDENT" },
        });
        return user.username;
      }
      let name = "";
      for (let attempt = 0; attempt < 20; attempt++) {
        name = studentUsername(student.firstName, student.studentNumber, attempt);
        if (!(await tx.user.findUnique({ where: { username: name } }))) break;
      }
      const user = await tx.user.create({
        data: {
          username: name,
          passwordHash,
          firstName: student.firstName,
          lastName: student.lastName,
          firstNameAr: student.firstNameAr,
          lastNameAr: student.lastNameAr,
          preferredLocale: ctx.school.defaultLocale,
          memberships: { create: { schoolId, role: "STUDENT" } },
        },
      });
      await tx.student.update({ where: { id: student.id }, data: { userId: user.id } });
      return name;
    });

    return { ok: true, credentials: { login: username ?? "", password } };
  });
}

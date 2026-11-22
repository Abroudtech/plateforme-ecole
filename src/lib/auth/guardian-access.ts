import "server-only";
import type { Guardian } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "./password";
import { generateTempPassword } from "./temp-password";

export type GuardianAccessResult =
  | { status: "created" | "reset"; login: string; password: string }
  | { status: "linked"; login: string }
  | { status: "conflict" | "noContact" };

/**
 * Crée l'accès d'un parent à l'application, ou lui donne un nouveau mot de
 * passe provisoire.
 * - Jamais de changement du mot de passe d'un compte du personnel.
 * - Un compte déjà utilisé dans un autre établissement est seulement relié à
 *   l'école (son mot de passe ne change pas).
 */
export async function provisionGuardianAccess(
  school: { id: string; defaultLocale: "fr" | "ar" },
  guardian: Guardian,
  { resetExisting = true } = {},
): Promise<GuardianAccessResult> {
  const schoolId = school.id;
  if (!guardian.phone && !guardian.email) return { status: "noContact" };
  const login = guardian.phone ? guardian.phone.replace(/^\+216/, "") : guardian.email!;

  // Compte déjà relié, ou compte existant avec le même téléphone / e-mail.
  const or = [guardian.phone ? { phone: guardian.phone } : null, guardian.email ? { email: guardian.email } : null].filter((x) => x !== null);
  const user =
    (guardian.userId && (await db.user.findUnique({ where: { id: guardian.userId }, include: { memberships: true } }))) ||
    (await db.user.findFirst({ where: { OR: or }, include: { memberships: true } }));

  if (user && (user.isPlatformAdmin || user.memberships.some((m) => m.role !== "PARENT"))) return { status: "conflict" };

  const link = (userId: string) => [
    db.guardian.update({ where: { id: guardian.id }, data: { userId } }),
    db.membership.upsert({
      where: { userId_schoolId_role: { userId, schoolId, role: "PARENT" } },
      update: { isActive: true },
      create: { userId, schoolId, role: "PARENT" },
    }),
  ];

  if (user && (!resetExisting || user.memberships.some((m) => m.isActive && m.schoolId !== schoolId))) {
    await db.$transaction(link(user.id));
    return { status: "linked", login };
  }

  const password = generateTempPassword();
  const passwordHash = await hashPassword(password);
  if (user) {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash, isActive: true } }),
      // Le mot de passe change : on déconnecte les anciennes sessions.
      db.session.deleteMany({ where: { userId: user.id } }),
      ...link(user.id),
    ]);
    return { status: "reset", login, password };
  }
  await db.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        phone: guardian.phone,
        email: guardian.email,
        passwordHash,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        firstNameAr: guardian.firstNameAr,
        lastNameAr: guardian.lastNameAr,
        preferredLocale: school.defaultLocale,
      },
    });
    await tx.guardian.update({ where: { id: guardian.id }, data: { userId: account.id } });
    await tx.membership.create({ data: { userId: account.id, schoolId, role: "PARENT" } });
  });
  return { status: "created", login, password };
}

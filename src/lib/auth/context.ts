import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { can, type Permission } from "./permissions";
import { readSession } from "./session";

/**
 * "Contexte" de la personne connectée : qui elle est, dans quelle école elle
 * travaille en ce moment et avec quels rôles.
 *
 * RÈGLE D'OR : toute lecture/écriture de données d'école doit utiliser
 * `ctx.school.id` comme filtre `schoolId`. C'est ce qui garantit qu'une école
 * ne voit jamais les données d'une autre.
 */
export type AppContext = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

const loadContext = cache(async () => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { isActive: true, school: { isActive: true } },
        include: { school: true },
      },
    },
  });
  if (!user || !user.isActive) return null;

  // Écoles accessibles à ce compte (une même école peut apparaître plusieurs
  // fois si la personne y a plusieurs rôles).
  const schools = [
    ...new Map(user.memberships.map((m) => [m.school.id, m.school])).values(),
  ];
  const school =
    schools.find((s) => s.id === session.activeSchoolId) ?? schools[0] ?? null;

  const roles: Role[] = school
    ? user.memberships.filter((m) => m.schoolId === school.id).map((m) => m.role)
    : [];

  return {
    session,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      firstNameAr: user.firstNameAr,
      lastNameAr: user.lastNameAr,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    school,
    schools,
    roles,
  };
});

/** Contexte de la personne connectée, ou null. */
export async function getOptionalContext() {
  return loadContext();
}

/**
 * Exige une personne connectée ET rattachée à une école.
 * Sinon, renvoie vers la page de connexion.
 */
export async function requireContext(lang: Locale) {
  const ctx = await loadContext();
  if (!ctx) redirect(`/${lang}/connexion`);
  if (!ctx.school) redirect(`/${lang}/connexion?erreur=acces`);
  return { ...ctx, school: ctx.school };
}

/** Exige une permission précise ; sinon page "accès refusé". */
export async function requirePermission(lang: Locale, permission: Permission) {
  const ctx = await requireContext(lang);
  if (!can(ctx.roles, permission)) redirect(`/${lang}/acces-refuse`);
  return ctx;
}

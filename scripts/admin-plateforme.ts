/**
 * Donne l'accès à l'espace plateforme (gestion de toutes les écoles clientes).
 * Réservé à l'équipe de la plateforme, jamais à une école cliente.
 *
 *   EMAIL="equipe@plateforme.tn" PRENOM="Manar" NOM="Abroud" npm run plateforme:admin
 *
 * Si le compte n'existe pas, il est créé et son mot de passe provisoire est affiché.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { generateTempPassword } from "../src/lib/auth/temp-password";

const db = new PrismaClient();

async function main() {
  const email = process.env.EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Variable manquante : EMAIL");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
    console.log("✔ Accès plateforme donné à", email, "(mot de passe inchangé)");
    return;
  }
  const password = generateTempPassword(12);
  await db.user.create({
    data: { email, firstName: process.env.PRENOM?.trim() || "Équipe", lastName: process.env.NOM?.trim() || "Plateforme", passwordHash: await hashPassword(password), isPlatformAdmin: true },
  });
  console.log("✔ Compte plateforme créé :", email);
  console.log("  Mot de passe provisoire :", password);
}

main()
  .catch((e) => {
    console.error("✘", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

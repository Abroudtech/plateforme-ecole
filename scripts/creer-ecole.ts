/**
 * Crée une école réelle (sans données de démonstration) et son premier
 * compte administration. À lancer une seule fois lors de la mise en ligne.
 *
 *   ECOLE_NOM_FR="École Les Oliviers" ECOLE_NOM_AR="مدرسة الزياتين" \
 *   ECOLE_VILLE="Sfax" ECOLE_CYCLES="PRIMARY,MIDDLE" ANNEE="2026-2027" \
 *   ADMIN_EMAIL="direction@ecole.tn" ADMIN_PRENOM="Manar" ADMIN_NOM="Abroud" \
 *   npm run ecole:creer
 *
 * Le mot de passe provisoire du compte est affiché à la fin : à changer
 * dès la première connexion (menu « Compte »).
 */
import { PrismaClient, type Cycle } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { generateTempPassword } from "../src/lib/auth/temp-password";
import { bootstrapSchool } from "../src/lib/setup/school";

const db = new PrismaClient();

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`✘ Variable manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ecole";
}

async function main() {
  const nameFr = need("ECOLE_NOM_FR");
  const nameAr = need("ECOLE_NOM_AR");
  const email = need("ADMIN_EMAIL").toLowerCase();
  const firstName = need("ADMIN_PRENOM");
  const lastName = need("ADMIN_NOM");
  const yearLabel = process.env.ANNEE?.trim() || "2026-2027";
  if (!/^\d{4}-\d{4}$/.test(yearLabel)) throw new Error("ANNEE doit ressembler à 2026-2027");
  const cycles = (process.env.ECOLE_CYCLES ?? "PRIMARY,MIDDLE,SECONDARY")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is Cycle => ["PRIMARY", "MIDDLE", "SECONDARY"].includes(c));
  if (cycles.length === 0) throw new Error("ECOLE_CYCLES : PRIMARY, MIDDLE et/ou SECONDARY");

  let slug = slugify(nameFr);
  if (await db.school.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;

  const { school } = await bootstrapSchool(db, { slug, nameFr, nameAr, city: process.env.ECOLE_VILLE?.trim() || null, cycles, yearLabel });

  const existing = await db.user.findUnique({ where: { email } });
  let password: string | null = null;
  const user =
    existing ??
    (await db.user.create({
      data: { email, firstName, lastName, passwordHash: await hashPassword((password = generateTempPassword(12))) },
    }));
  await db.membership.create({ data: { userId: user.id, schoolId: school.id, role: "ADMIN" } });

  console.log("✔ École créée :", nameFr, `(${cycles.join(", ")}, année ${yearLabel})`);
  console.log("  Connexion :", email);
  console.log(password ? `  Mot de passe provisoire : ${password}` : "  (compte déjà existant : mot de passe inchangé)");
}

main()
  .catch((e) => {
    console.error("✘", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

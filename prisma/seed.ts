/**
 * Données de démonstration : une école avec les trois cycles, quelques
 * classes, des élèves, et des comptes administration, parent, enseignant et élève.
 *
 * Lancer : npm run db:seed
 * Mot de passe des comptes de démo : variable SEED_PASSWORD (sinon "Demo2026!").
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoSchool } from "../src/lib/setup/demo";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo2026!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await seedDemoSchool(db, passwordHash);
  console.log("✔ Données de démonstration prêtes.");
  console.log(`  Administration : admin@demo.tn / ${PASSWORD}`);
  console.log(`  Parent         : 22 000 000 (ou parent@demo.tn) / ${PASSWORD}`);
  console.log(`  Enseignant     : enseignant@demo.tn / ${PASSWORD}`);
  console.log(`  Élève          : yasmine.demo / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

/**
 * Données de démonstration : une école avec les trois cycles, quelques
 * classes, des élèves, un compte administration et un compte parent.
 *
 * Lancer : npm run db:seed
 * Mot de passe des comptes de démo : variable SEED_PASSWORD (sinon "Demo2026!").
 */
import { PrismaClient, type Cycle } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GRADE_LEVELS, SUBJECTS, TRACKS, TRIMESTERS } from "../src/lib/setup/tunisia";
import { applyDefaultCurriculum } from "../src/lib/setup/curriculum";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo2026!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const cycles: Cycle[] = ["PRIMARY", "MIDDLE", "SECONDARY"];

  const school = await db.school.upsert({
    where: { slug: "ecole-demo" },
    update: {},
    create: {
      slug: "ecole-demo",
      nameFr: "École Privée Démo",
      nameAr: "المدرسة الخاصة التجريبية",
      city: "Tunis",
      cycles,
    },
  });
  const schoolId = school.id;

  // Référentiel tunisien : niveaux, filières, matières.
  for (const level of GRADE_LEVELS) {
    await db.gradeLevel.upsert({
      where: { schoolId_code: { schoolId, code: level.code } },
      update: {},
      create: { schoolId, ...level },
    });
  }
  for (const track of TRACKS) {
    await db.track.upsert({
      where: { schoolId_code: { schoolId, code: track.code } },
      update: {},
      create: { schoolId, ...track },
    });
  }
  for (const subject of SUBJECTS) {
    await db.subject.upsert({
      where: { schoolId_code: { schoolId, code: subject.code } },
      update: {},
      create: { schoolId, ...subject },
    });
  }

  // Année scolaire en cours et trimestres.
  const year = await db.academicYear.upsert({
    where: { schoolId_label: { schoolId, label: "2026-2027" } },
    update: {},
    create: {
      schoolId,
      label: "2026-2027",
      startDate: new Date("2026-09-15"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
    },
  });
  if ((await db.term.count({ where: { academicYearId: year.id } })) === 0) {
    await db.term.createMany({
      data: TRIMESTERS.map((t) => ({ schoolId, academicYearId: year.id, ...t })),
    });
  }

  // Quelques classes, une par cycle au minimum.
  const level = async (code: string) =>
    db.gradeLevel.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } });
  const track = async (code: string) =>
    db.track.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } });

  const classDefs = [
    { name: "1A", nameAr: "1 أ", level: "P1" },
    { name: "6A", nameAr: "6 أ", level: "P6" },
    { name: "7B1", nameAr: "7 أساسي 1", level: "C7" },
    { name: "9B1", nameAr: "9 أساسي 1", level: "C9" },
    { name: "1S1", nameAr: "1 ثانوي 1", level: "S1" },
    { name: "4M1", nameAr: "4 رياضيات 1", level: "S4", track: "MATH" },
  ];
  const classes: Record<string, string> = {};
  for (const def of classDefs) {
    const cg = await db.classGroup.upsert({
      where: { schoolId_academicYearId_name: { schoolId, academicYearId: year.id, name: def.name } },
      update: {},
      create: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: (await level(def.level)).id,
        trackId: def.track ? (await track(def.track)).id : null,
        name: def.name,
        nameAr: def.nameAr,
        capacity: 30,
      },
    });
    classes[def.name] = cg.id;
  }

  // Compte administration.
  const admin = await db.user.upsert({
    where: { email: "admin@demo.tn" },
    update: {},
    create: {
      email: "admin@demo.tn",
      passwordHash,
      firstName: "Direction",
      lastName: "Démo",
      firstNameAr: "الإدارة",
      lastNameAr: "التجريبية",
    },
  });
  await db.membership.upsert({
    where: { userId_schoolId_role: { userId: admin.id, schoolId, role: "ADMIN" } },
    update: {},
    create: { userId: admin.id, schoolId, role: "ADMIN" },
  });

  // Compte parent (connexion par téléphone) et ses deux enfants.
  const parentUser = await db.user.upsert({
    where: { phone: "+21622000000" },
    update: {},
    create: {
      phone: "+21622000000",
      email: "parent@demo.tn",
      passwordHash,
      firstName: "Sami",
      lastName: "Ben Salah",
      firstNameAr: "سامي",
      lastNameAr: "بن صالح",
      preferredLocale: "ar",
    },
  });
  await db.membership.upsert({
    where: { userId_schoolId_role: { userId: parentUser.id, schoolId, role: "PARENT" } },
    update: {},
    create: { userId: parentUser.id, schoolId, role: "PARENT" },
  });
  const guardian = await db.guardian.upsert({
    where: { schoolId_userId: { schoolId, userId: parentUser.id } },
    update: {},
    create: {
      schoolId,
      userId: parentUser.id,
      firstName: "Sami",
      lastName: "Ben Salah",
      firstNameAr: "سامي",
      lastNameAr: "بن صالح",
      phone: "+21622000000",
    },
  });

  const students = [
    { n: "2026-001", fn: "Yasmine", ln: "Ben Salah", fa: "ياسمين", la: "بن صالح", g: "FEMALE", cls: "6A", child: true },
    { n: "2026-002", fn: "Adam", ln: "Ben Salah", fa: "آدم", la: "بن صالح", g: "MALE", cls: "9B1", child: true },
    { n: "2026-003", fn: "Mariem", ln: "Trabelsi", fa: "مريم", la: "الطرابلسي", g: "FEMALE", cls: "1A" },
    { n: "2026-004", fn: "Youssef", ln: "Gharbi", fa: "يوسف", la: "الغربي", g: "MALE", cls: "7B1" },
    { n: "2026-005", fn: "Ines", ln: "Jlassi", fa: "إيناس", la: "الجلاصي", g: "FEMALE", cls: "1S1" },
    { n: "2026-006", fn: "Omar", ln: "Mejri", fa: "عمر", la: "الماجري", g: "MALE", cls: "4M1" },
  ] as const;

  for (const s of students) {
    const student = await db.student.upsert({
      where: { schoolId_studentNumber: { schoolId, studentNumber: s.n } },
      update: {},
      create: {
        schoolId,
        studentNumber: s.n,
        firstName: s.fn,
        lastName: s.ln,
        firstNameAr: s.fa,
        lastNameAr: s.la,
        gender: s.g,
      },
    });
    await db.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
      update: {},
      create: { schoolId, studentId: student.id, academicYearId: year.id, classGroupId: classes[s.cls] },
    });
    if ("child" in s) {
      await db.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
        update: {},
        create: { studentId: student.id, guardianId: guardian.id, relationship: "FATHER", isPrimary: true },
      });
    }
  }

  // Programme par défaut (matières + coefficients) pour chaque classe.
  const allClasses = await db.classGroup.findMany({ where: { schoolId, academicYearId: year.id } });
  for (const c of allClasses) await applyDefaultCurriculum(db, schoolId, c.gradeLevelId, c.trackId);

  // Quelques notes du 1er trimestre en 6A pour montrer un bulletin.
  const t1 = await db.term.findFirstOrThrow({ where: { academicYearId: year.id, order: 1 } });
  const sixA = classes["6A"];
  if ((await db.assessment.count({ where: { classGroupId: sixA } })) === 0) {
    const yasmine = await db.student.findUniqueOrThrow({ where: { schoolId_studentNumber: { schoolId, studentNumber: "2026-001" } } });
    const demoScores: Record<string, [number, number]> = { AR: [15, 16.5], FR: [13, 14], MATH: [17, 18.5], EVEIL: [14, 15], EN: [12, 13.5] };
    for (const [code, [control, synthesis]] of Object.entries(demoScores)) {
      const subject = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } });
      for (const [kind, score] of [["CONTROL", control], ["SYNTHESIS", synthesis]] as const) {
        const a = await db.assessment.create({
          data: { schoolId, classGroupId: sixA, subjectId: subject.id, termId: t1.id, kind, weight: kind === "SYNTHESIS" ? 2 : 1 },
        });
        await db.grade.create({ data: { schoolId, assessmentId: a.id, studentId: yasmine.id, score } });
      }
    }
    await db.reportCardPublication.create({ data: { schoolId, classGroupId: sixA, termId: t1.id } });
  }

  console.log("✔ Données de démonstration prêtes.");
  console.log(`  Administration : admin@demo.tn / ${PASSWORD}`);
  console.log(`  Parent         : 22 000 000 (ou parent@demo.tn) / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

import type { Cycle, PrismaClient } from "@prisma/client";
import { GRADE_LEVELS, SUBJECTS, TRACKS, TRIMESTERS } from "./tunisia";
import { applyDefaultCurriculum } from "./curriculum";
import { trimesterDates } from "./school";

/** Identifiants des comptes de l'école de démonstration. */
export const DEMO_SCHOOL_SLUG = "ecole-demo";
export const DEMO_ADMIN_EMAIL = "admin@demo.tn";
export const DEMO_PARENT_PHONE = "22 000 000";
export const DEMO_TEACHER_EMAIL = "enseignant@demo.tn";
export const DEMO_STUDENT_LOGIN = "yasmine.demo";

/**
 * École de démonstration : les trois cycles, quelques classes, des élèves avec
 * notes, absences, paiements, emplois du temps et messages, un compte
 * administration, un compte parent, un compte enseignant et un compte élève.
 *
 * Utilisée en local (npm run db:seed) et en ligne pour les testeurs de Google
 * et d'Apple (espace plateforme). Peut être relancée : rien n'est créé deux
 * fois, seul le mot de passe des comptes est remplacé.
 */
export async function seedDemoSchool(db: PrismaClient, passwordHash: string) {
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
      data: TRIMESTERS.map((t, i) => ({ schoolId, academicYearId: year.id, ...t, ...trimesterDates("2026-2027")[i] })),
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
    update: { passwordHash },
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
    update: { passwordHash },
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
    // Oral, contrôle, synthèse (structure par défaut : ×1, ×1, ×2).
    const demoScores: Record<string, [number, number, number]> = { AR: [16, 15, 16.5], FR: [14, 13, 14], MATH: [18, 17, 18.5], EVEIL: [15, 14, 15], EN: [13, 12, 13.5] };
    for (const [code, [oral, control, synthesis]] of Object.entries(demoScores)) {
      const subject = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } });
      for (const [kind, score] of [["ORAL", oral], ["CONTROL", control], ["SYNTHESIS", synthesis]] as const) {
        const a = await db.assessment.create({
          data: { schoolId, classGroupId: sixA, subjectId: subject.id, termId: t1.id, kind },
        });
        await db.grade.create({ data: { schoolId, assessmentId: a.id, studentId: yasmine.id, score } });
      }
    }
    await db.reportCardPublication.create({ data: { schoolId, classGroupId: sixA, termId: t1.id } });

    // 2e trimestre (non publié) : pour voir la moyenne annuelle provisoire.
    const t2 = await db.term.findFirstOrThrow({ where: { academicYearId: year.id, order: 2 } });
    const t2Scores: Record<string, [number, number, number]> = { AR: [17, 16, 17], FR: [15, 14, 15.5], MATH: [18, 18, 19], EVEIL: [14, 15, 15], EN: [14, 13, 14] };
    for (const [code, [oral, control, synthesis]] of Object.entries(t2Scores)) {
      const subject = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } });
      for (const [kind, score] of [["ORAL", oral], ["CONTROL", control], ["SYNTHESIS", synthesis]] as const) {
        const a = await db.assessment.create({ data: { schoolId, classGroupId: sixA, subjectId: subject.id, termId: t2.id, kind } });
        await db.grade.create({ data: { schoolId, assessmentId: a.id, studentId: yasmine.id, score } });
      }
    }
  }

  // Une absence de démonstration pour Adam (enfant du compte parent).
  const adam = await db.student.findUniqueOrThrow({ where: { schoolId_studentNumber: { schoolId, studentNumber: "2026-002" } } });
  await db.attendanceRecord.upsert({
    where: { studentId_date_period: { studentId: adam.id, date: new Date("2026-11-10"), period: "MORNING" } },
    update: {},
    create: { schoolId, studentId: adam.id, classGroupId: classes["9B1"], date: new Date("2026-11-10"), period: "MORNING", status: "ABSENT", justified: true, reason: "Certificat médical" },
  });

  // Emplois du temps : quelques enseignants, salles et cours en 6A et 7B1.
  if ((await db.teacher.count({ where: { schoolId } })) === 0) {
    const teacherDefs = [
      { key: "ar", firstName: "Mounir", lastName: "Trabelsi", firstNameAr: "منير", lastNameAr: "الطرابلسي", phone: "+21698111222" },
      { key: "fr", firstName: "Leila", lastName: "Mansour", firstNameAr: "ليلى", lastNameAr: "منصور" },
      { key: "math", firstName: "Karim", lastName: "Jaziri", firstNameAr: "كريم", lastNameAr: "الجزيري" },
      { key: "en", firstName: "Sarra", lastName: "Hamdi", firstNameAr: "سارة", lastNameAr: "الحامدي" },
    ];
    const teacher: Record<string, string> = {};
    for (const { key, ...data } of teacherDefs) teacher[key] = (await db.teacher.create({ data: { schoolId, ...data } })).id;
    const room: Record<string, string> = {};
    for (const [name, capacity] of [["Salle 1", 30], ["Salle 2", 30], ["Labo", 24]] as const) {
      room[name] = (await db.room.create({ data: { schoolId, name, capacity } })).id;
    }
    const subjectId = async (code: string) => (await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code } } })).id;
    const h = (t: string) => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };
    // [classe, jour, début, fin, matière, enseignant, salle]
    const slots: [string, number, string, string, string, string, string][] = [
      ["6A", 1, "08:00", "10:00", "AR", "ar", "Salle 1"],
      ["6A", 1, "10:15", "12:00", "MATH", "math", "Salle 1"],
      ["6A", 2, "08:00", "10:00", "FR", "fr", "Salle 1"],
      ["6A", 2, "10:15", "11:15", "EN", "en", "Salle 1"],
      ["6A", 3, "08:00", "10:00", "MATH", "math", "Salle 1"],
      ["6A", 4, "08:00", "10:00", "AR", "ar", "Salle 1"],
      ["6A", 4, "14:00", "15:00", "EVEIL", "fr", "Labo"],
      ["6A", 5, "08:00", "09:00", "FR", "fr", "Salle 1"],
      ["7B1", 1, "08:00", "10:00", "MATH", "math", "Salle 2"],
      ["7B1", 2, "08:00", "10:00", "AR", "ar", "Salle 2"],
      ["7B1", 3, "10:15", "12:00", "FR", "fr", "Salle 2"],
    ];
    for (const [cls, dayOfWeek, start, end, code, t, r] of slots) {
      await db.timetableEntry.create({
        data: { schoolId, classGroupId: classes[cls], dayOfWeek, startMinute: h(start), endMinute: h(end), subjectId: await subjectId(code), teacherId: teacher[t], roomId: room[r] },
      });
    }
    // Heures prévues au programme de 6e (pour comparer avec l'emploi du temps).
    const p6 = await db.gradeLevel.findFirstOrThrow({ where: { schoolId, code: "P6" } });
    for (const [code, hours] of [["AR", 5], ["FR", 4], ["MATH", 5], ["EVEIL", 2], ["EN", 1.5]] as const) {
      await db.curriculumSubject.updateMany({ where: { schoolId, gradeLevelId: p6.id, trackId: null, subjectId: await subjectId(code) }, data: { hoursPerWeek: hours } });
    }
  }

  // Compte enseignant (M. Jaziri, mathématiques en 6A et 7B1) et compte élève (Yasmine, 6A).
  const teacherUser = await db.user.upsert({
    where: { email: DEMO_TEACHER_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_TEACHER_EMAIL, passwordHash, firstName: "Karim", lastName: "Jaziri", firstNameAr: "كريم", lastNameAr: "الجزيري" },
  });
  await db.membership.upsert({
    where: { userId_schoolId_role: { userId: teacherUser.id, schoolId, role: "TEACHER" } },
    update: {},
    create: { userId: teacherUser.id, schoolId, role: "TEACHER" },
  });
  const karim = await db.teacher.findFirst({ where: { schoolId, firstName: "Karim", lastName: "Jaziri" } });
  if (karim && !karim.userId) await db.teacher.update({ where: { id: karim.id }, data: { userId: teacherUser.id } });
  if (karim) {
    for (const cls of ["6A", "7B1"]) {
      await db.teacherAssignment.upsert({
        where: { teacherId_classGroupId: { teacherId: karim.id, classGroupId: classes[cls] } },
        update: {},
        create: { schoolId, teacherId: karim.id, classGroupId: classes[cls] },
      });
    }
  }
  const yasmineStudent = await db.student.findUniqueOrThrow({ where: { schoolId_studentNumber: { schoolId, studentNumber: "2026-001" } } });
  const studentUser = await db.user.upsert({
    where: { username: DEMO_STUDENT_LOGIN },
    update: { passwordHash },
    create: { username: DEMO_STUDENT_LOGIN, passwordHash, firstName: "Yasmine", lastName: "Ben Salah", firstNameAr: "ياسمين", lastNameAr: "بن صالح" },
  });
  await db.membership.upsert({
    where: { userId_schoolId_role: { userId: studentUser.id, schoolId, role: "STUDENT" } },
    update: {},
    create: { userId: studentUser.id, schoolId, role: "STUDENT" },
  });
  if (!yasmineStudent.userId) await db.student.update({ where: { id: yasmineStudent.id }, data: { userId: studentUser.id } });

  // Calendrier : un examen annoncé en 6A et deux dates de l'école, quelques jours après la création.
  if ((await db.exam.count({ where: { schoolId } })) === 0) {
    const inDays = (n: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + n);
      // Pas d'examen le dimanche.
      if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
      return d;
    };
    const math = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code: "MATH" } } });
    const ar = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code: "AR" } } });
    await db.exam.createMany({
      data: [
        { schoolId, classGroupId: classes["6A"], subjectId: math.id, authorId: teacherUser.id, kind: "CONTROL", title: "Les fractions", date: inDays(3), startMinute: 8 * 60, durationMinutes: 60, room: "Salle 1", revision: "Leçons 7 et 8 : comparer et additionner des fractions. Exercices 2 à 5 page 64." },
        { schoolId, classGroupId: classes["6A"], subjectId: ar.id, kind: "SYNTHESIS", title: "الإنتاج الكتابي", date: inDays(9), startMinute: 10 * 60 + 15, durationMinutes: 90, revision: "مراجعة دروس الثلاثي الأول في القراءة والقواعد." },
      ],
    });
    await db.schoolEvent.createMany({
      data: [
        { schoolId, kind: "MEETING", title: "Réunion parents-enseignants · اجتماع الأولياء", date: inDays(6), details: "De 9h à 12h, dans les classes.", createdById: admin.id },
        { schoolId, kind: "HOLIDAY", title: "Vacances d'hiver · عطلة الشتاء", date: inDays(24), endDate: inDays(38), createdById: admin.id },
      ],
    });
  }

  // Un défi de calcul en 6A, prêt à être lancé en direct.
  if ((await db.challenge.count({ where: { schoolId } })) === 0) {
    const math = await db.subject.findUniqueOrThrow({ where: { schoolId_code: { schoolId, code: "MATH" } } });
    await db.challenge.create({
      data: {
        schoolId,
        classGroupId: classes["6A"],
        authorId: teacherUser.id,
        subjectId: math.id,
        title: "Les fractions en 5 questions",
        questions: [
          { q: "Quelle fraction est égale à 1/2 ?", choices: ["2/4", "1/3", "3/4", "2/3"], answer: 0 },
          { q: "3/4 + 1/4 = ?", choices: ["4/8", "1", "3/16", "2/4"], answer: 1 },
          { q: "Quelle est la plus grande fraction ?", choices: ["1/5", "1/3", "1/2", "1/4"], answer: 2 },
          { q: "La moitié de 3/5, c'est…", choices: ["3/10", "6/5", "3/2", "1/5"], answer: 0 },
          { q: "Combien de quarts dans 2 unités ?", choices: ["4", "6", "8", "2"], answer: 2 },
        ],
      },
    });
  }

  // Paiements : frais de l'année, quelques encaissements (Adam a un impayé).
  if ((await db.fee.count({ where: { schoolId, academicYearId: year.id } })) === 0) {
    const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const feeDefs = [
      { name: "Frais d'inscription", nameAr: "معلوم الترسيم", amountMillimes: 300_000, dueDate: d("2026-09-15") },
      { name: "Scolarité 1er trimestre", nameAr: "معاليم الثلاثي الأول", amountMillimes: 1_200_000, dueDate: d("2026-09-30") },
      { name: "Scolarité 2e trimestre", nameAr: "معاليم الثلاثي الثاني", amountMillimes: 1_200_000, dueDate: d("2027-01-05") },
      { name: "Scolarité 3e trimestre", nameAr: "معاليم الثلاثي الثالث", amountMillimes: 1_200_000, dueDate: d("2027-03-30") },
      { name: "Cantine 1er trimestre", nameAr: "المطعم - الثلاثي الأول", amountMillimes: 350_000, dueDate: d("2026-10-01"), isOptional: true },
    ];
    const fees = [];
    for (const f of feeDefs) fees.push(await db.fee.create({ data: { schoolId, academicYearId: year.id, ...f } }));
    const byNumber = async (n: string) => (await db.student.findUniqueOrThrow({ where: { schoolId_studentNumber: { schoolId, studentNumber: n } } })).id;
    const yasmine = await byNumber("2026-001");
    await db.studentFee.create({ data: { schoolId, studentId: yasmine, feeId: fees[4].id } });
    const payments: [string, number, string, "CASH" | "CHECK" | "TRANSFER", string | null][] = [
      ["2026-001", 1_500_000, "2026-09-10", "CHECK", "4512 3378"],
      ["2026-001", 350_000, "2026-10-01", "CASH", null],
      ["2026-002", 300_000, "2026-09-12", "CASH", null],
      ["2026-003", 1_500_000, "2026-09-14", "TRANSFER", "VIR-0921"],
      ["2026-004", 900_000, "2026-09-20", "CASH", null],
      ["2026-005", 1_500_000, "2026-09-15", "CASH", null],
    ];
    let receipt = 1;
    for (const [n, amountMillimes, paidAt, method, reference] of payments) {
      await db.payment.create({
        data: { schoolId, academicYearId: year.id, studentId: await byNumber(n), receiptNumber: receipt++, amountMillimes, method, reference, paidAt: d(paidAt), createdById: admin.id },
      });
    }
  }

  // Messagerie : une annonce et une conversation avec le parent de démonstration.
  if ((await db.announcement.count({ where: { schoolId } })) === 0) {
    await db.announcement.create({
      data: {
        schoolId,
        title: "Réunion parents-enseignants le 5 décembre",
        body: "Les parents sont invités à rencontrer les enseignants le samedi 5 décembre de 9h à 12h.\nاجتماع الأولياء بالمربين يوم السبت 5 ديسمبر من الساعة 9 إلى الساعة 12.",
        audience: "SCHOOL",
        createdById: admin.id,
      },
    });
    const adamId = (await db.student.findUniqueOrThrow({ where: { schoolId_studentNumber: { schoolId, studentNumber: "2026-002" } } })).id;
    const t0 = new Date("2026-11-18T08:30:00Z");
    await db.conversation.create({
      data: {
        schoolId,
        guardianId: guardian.id,
        studentId: adamId,
        subject: "Absence du 10 novembre",
        lastMessageAt: new Date(t0.getTime() + 3600_000),
        messages: {
          create: [
            { authorId: admin.id, fromSchool: true, body: "Bonjour, nous avons bien reçu le certificat médical pour l'absence d'Adam. Bon rétablissement !", createdAt: t0 },
            { authorId: parentUser.id, fromSchool: false, body: "Merci beaucoup. Adam revient demain.", createdAt: new Date(t0.getTime() + 3600_000) },
          ],
        },
      },
    });
  }

  // Page vitrine d'exemple (non publiée : la direction de démo la voit en aperçu).
  await db.schoolSite.upsert({
    where: { schoolId },
    update: {},
    create: {
      schoolId,
      theme: "encre",
      heroTitleFr: "Apprendre, grandir, s'épanouir",
      heroTitleAr: "نتعلّم، نكبر، نتألّق",
      heroTextFr: "Une école à taille humaine, de l'année préparatoire au baccalauréat, où chaque enfant est connu par son prénom.",
      heroTextAr: "مدرسة على مقاس الإنسان، من السنة التحضيرية إلى الباكالوريا، حيث نعرف كل طفل باسمه.",
      aboutFr:
        "Fondée en 2009, notre école accueille aujourd'hui plus de 400 élèves du primaire au lycée.\n\nNous suivons le programme officiel tunisien, enrichi par un apprentissage renforcé des langues, des activités culturelles et sportives, et un suivi personnalisé de chaque élève.",
      aboutAr:
        "تأسست مدرستنا سنة 2009، وتستقبل اليوم أكثر من 400 تلميذ من الابتدائي إلى الثانوي.\n\nنتّبع البرنامج الرسمي التونسي، مع تعزيز تعلّم اللغات والأنشطة الثقافية والرياضية، ومتابعة شخصية لكل تلميذ.",
      highlights: [
        { titleFr: "Petits effectifs", titleAr: "أقسام صغيرة", textFr: "24 élèves au maximum par classe pour un vrai suivi.", textAr: "24 تلميذاً على الأكثر في القسم لمتابعة حقيقية." },
        { titleFr: "Trois langues", titleAr: "ثلاث لغات", textFr: "Arabe, français et anglais dès la 1re année.", textAr: "العربية والفرنسية والإنجليزية منذ السنة الأولى." },
        { titleFr: "Cantine et garderie", titleAr: "مطعم وحضانة", textFr: "Repas équilibrés préparés sur place, garderie jusqu'à 18h.", textAr: "وجبات متوازنة تُحضَّر في المدرسة، وحضانة حتى الساعة 18." },
        { titleFr: "Transport scolaire", titleAr: "النقل المدرسي", textFr: "Plusieurs circuits dans le Grand Tunis.", textAr: "عدة خطوط في تونس الكبرى." },
        { titleFr: "Clubs et sorties", titleAr: "نوادٍ ورحلات", textFr: "Théâtre, robotique, échecs, sport et sorties pédagogiques.", textAr: "مسرح، روبوتيك، شطرنج، رياضة ورحلات تربوية." },
        { titleFr: "Parents informés", titleAr: "أولياء على اطّلاع", textFr: "Notes, absences et messages sur l'application Ma Plume.", textAr: "الأعداد والغيابات والرسائل على تطبيق Ma Plume." },
      ],
      admissionsFr: "Les inscriptions pour l'année 2027-2028 sont ouvertes à partir du 1er mars.\n\nDocuments à fournir : extrait de naissance, bulletins de l'année précédente, deux photos d'identité. Un rendez-vous avec la direction est proposé à chaque famille.",
      admissionsAr: "التسجيل للسنة الدراسية 2027-2028 مفتوح بداية من غرة مارس.\n\nالوثائق المطلوبة: مضمون ولادة، بطاقات الأعداد للسنة الفارطة، صورتان شمسيتان. تقترح الإدارة موعداً على كل عائلة.",
      hoursFr: "Du lundi au vendredi, 7h30 - 17h30 · samedi matin",
      hoursAr: "من الإثنين إلى الجمعة، 7:30 - 17:30 · السبت صباحاً",
      whatsapp: "+21622000000",
      facebookUrl: "https://facebook.com/",
    },
  });

  return { schoolId };
}

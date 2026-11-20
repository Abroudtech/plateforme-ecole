import type { Issue, ParsedWorkbook, ParsedRow } from "./parse";
import { normalizeKey } from "./parse";
import type { SheetKey } from "./schema";

/**
 * Prépare l'import sans rien écrire : pour chaque ligne, dit si elle sera
 * créée, si elle existe déjà (et sera ignorée), si elle complète une fiche
 * existante, ou si elle contient une erreur. L'import ne supprime jamais rien,
 * et on peut renvoyer le même fichier plusieurs fois sans créer de doublons.
 */

// ---------------------------------------------------------------------------
// Ce qui existe déjà dans l'école
// ---------------------------------------------------------------------------

export type Snapshot = {
  yearId: string | null;
  /** Préfixe des matricules automatiques, par ex. "2026". */
  yearPrefix: string;
  levels: { id: string; code: string; nameFr: string; nameAr: string; cycle: string }[];
  tracks: { id: string; code: string; nameFr: string; nameAr: string }[];
  /** Classes de l'année en cours. */
  classes: { id: string; name: string; nameAr: string | null; gradeLevelId: string; trackId: string | null }[];
  subjects: { id: string; code: string; nameFr: string; nameAr: string }[];
  curriculum: { id: string; gradeLevelId: string; trackId: string | null; subjectId: string; coefficient: number }[];
  rooms: { id: string; name: string }[];
  teachers: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null }[];
  students: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    /** Classe de l'année en cours, s'il est inscrit. */
    classId: string | null;
    guardianIds: string[];
    hasPrimary: boolean;
  }[];
  guardians: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null }[];
  /** Matricules déjà utilisés, pour en générer de nouveaux. */
  studentNumbers: string[];
};

// ---------------------------------------------------------------------------
// Résultat
// ---------------------------------------------------------------------------

export type RowStatus = "create" | "update" | "exists" | "error";
export type RowReport = { sheet: SheetKey; row: number; status: RowStatus; label: string; issues: Issue[] };
export type SheetCounts = Record<RowStatus, number>;

export type Plan = {
  rows: RowReport[];
  counts: Record<SheetKey, SheetCounts>;
  classes: { id: string; name: string; nameAr: string | null; gradeLevelId: string; trackId: string | null; capacity: number | null }[];
  subjects: { id: string; code: string; nameFr: string; nameAr: string }[];
  curriculumCreate: { id: string; gradeLevelId: string; trackId: string | null; subjectId: string; coefficient: number }[];
  curriculumUpdate: { id: string; coefficient: number }[];
  rooms: { id: string; name: string; capacity: number | null }[];
  teachers: { id: string; firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null; phone: string | null; email: string | null }[];
  students: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    gender: "MALE" | "FEMALE" | null;
    birthDate: string | null;
    birthPlace: string | null;
  }[];
  enrollments: { studentId: string; classGroupId: string }[];
  guardians: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null }[];
  links: { studentId: string; guardianId: string; relationship: "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER"; isPrimary: boolean }[];
};

const emptyCounts = (): SheetCounts => ({ create: 0, update: 0, exists: 0, error: 0 });

/** Nom complet comparable (« Ben Ali Mohamed » = « ben ali  MOHAMED »). */
const personKey = (firstName: string, lastName: string) => `${normalizeKey(lastName)}|${normalizeKey(firstName)}`;

/** Code court et unique pour une nouvelle matière : « Musique » → « MUSIQU ». */
function subjectCode(name: string, used: Set<string>) {
  const base = normalizeKey(name).replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 6) || "MAT";
  let code = base;
  for (let i = 2; used.has(code); i++) code = `${base}${i}`;
  used.add(code);
  return code;
}

export function planImport(book: ParsedWorkbook, snap: Snapshot, newId: () => string): Plan {
  const plan: Plan = {
    rows: [],
    counts: { classes: emptyCounts(), subjects: emptyCounts(), rooms: emptyCounts(), teachers: emptyCounts(), students: emptyCounts() },
    classes: [],
    subjects: [],
    curriculumCreate: [],
    curriculumUpdate: [],
    rooms: [],
    teachers: [],
    students: [],
    enrollments: [],
    guardians: [],
    links: [],
  };

  const report = (sheet: SheetKey, r: ParsedRow<unknown>, status: RowStatus, label: string, extra: Issue[] = []) => {
    const issues = [...r.issues, ...extra];
    const final: RowStatus = r.issues.length ? "error" : status;
    plan.rows.push({ sheet, row: r.row, status: final, label, issues });
    plan.counts[sheet][final]++;
  };

  // --- Index de recherche --------------------------------------------------
  const levelIndex = new Map<string, (typeof snap.levels)[number]>();
  for (const l of snap.levels) for (const k of [l.code, l.nameFr, l.nameAr]) levelIndex.set(normalizeKey(k), l);
  const trackIndex = new Map<string, (typeof snap.tracks)[number]>();
  for (const t of snap.tracks) for (const k of [t.code, t.nameFr, t.nameAr]) trackIndex.set(normalizeKey(k), t);

  const classIndex = new Map<string, string>(); // nom → id
  for (const c of snap.classes) {
    classIndex.set(normalizeKey(c.name), c.id);
    if (c.nameAr) classIndex.set(normalizeKey(c.nameAr), c.id);
  }
  const subjectIndex = new Map<string, string>();
  const usedCodes = new Set(snap.subjects.map((s) => s.code));
  for (const s of snap.subjects) for (const k of [s.code, s.nameFr, s.nameAr]) subjectIndex.set(normalizeKey(k), s.id);
  const curriculumIndex = new Map(snap.curriculum.map((c) => [`${c.gradeLevelId}|${c.trackId ?? ""}|${c.subjectId}`, c]));
  const roomIndex = new Set(snap.rooms.map((r) => normalizeKey(r.name)));

  const resolveLevel = (text: string) => levelIndex.get(normalizeKey(text)) ?? null;
  const resolveTrack = (text: string | null) => (text ? (trackIndex.get(normalizeKey(text)) ?? null) : null);

  // --- Classes ---------------------------------------------------------------
  for (const r of book.classes) {
    const d = r.data;
    const label = d.name;
    if (r.issues.length) {
      report("classes", r, "error", label);
      continue;
    }
    const existing = classIndex.get(normalizeKey(d.name));
    if (existing) {
      const fromFile = plan.classes.some((c) => c.id === existing);
      report("classes", r, fromFile ? "error" : "exists", label, fromFile ? [{ key: "duplicateInFile" }] : []);
      continue;
    }
    if (!snap.yearId) {
      report("classes", r, "error", label, [{ key: "noYear" }]);
      continue;
    }
    const level = resolveLevel(d.level);
    if (!level) {
      report("classes", r, "error", label, [{ key: "levelUnknown", params: { value: d.level } }]);
      continue;
    }
    const track = resolveTrack(d.track);
    if (d.track && !track) {
      report("classes", r, "error", label, [{ key: "trackUnknown", params: { value: d.track } }]);
      continue;
    }
    const id = newId();
    plan.classes.push({ id, name: d.name, nameAr: d.nameAr, gradeLevelId: level.id, trackId: track?.id ?? null, capacity: d.capacity ? Math.round(d.capacity) : null });
    classIndex.set(normalizeKey(d.name), id);
    if (d.nameAr) classIndex.set(normalizeKey(d.nameAr), id);
    report("classes", r, "create", label);
  }

  // --- Matières et coefficients ---------------------------------------------
  const seenCurriculum = new Set<string>();
  for (const r of book.subjects) {
    const d = r.data;
    const label = `${d.subject} · ${d.level}`;
    if (r.issues.length) {
      report("subjects", r, "error", label);
      continue;
    }
    const level = resolveLevel(d.level);
    if (!level) {
      report("subjects", r, "error", label, [{ key: "levelUnknown", params: { value: d.level } }]);
      continue;
    }
    const track = resolveTrack(d.track);
    if (d.track && !track) {
      report("subjects", r, "error", label, [{ key: "trackUnknown", params: { value: d.track } }]);
      continue;
    }
    let subjectId = subjectIndex.get(normalizeKey(d.subject)) ?? (d.subjectAr ? subjectIndex.get(normalizeKey(d.subjectAr)) : undefined);
    let newSubject = false;
    if (!subjectId) {
      subjectId = newId();
      newSubject = true;
      plan.subjects.push({ id: subjectId, code: subjectCode(d.subject, usedCodes), nameFr: d.subject, nameAr: d.subjectAr ?? d.subject });
      subjectIndex.set(normalizeKey(d.subject), subjectId);
      if (d.subjectAr) subjectIndex.set(normalizeKey(d.subjectAr), subjectId);
    }
    const key = `${level.id}|${track?.id ?? ""}|${subjectId}`;
    if (seenCurriculum.has(key)) {
      report("subjects", r, "error", label, [{ key: "duplicateInFile" }]);
      continue;
    }
    seenCurriculum.add(key);
    const existing = curriculumIndex.get(key);
    if (!existing) {
      plan.curriculumCreate.push({ id: newId(), gradeLevelId: level.id, trackId: track?.id ?? null, subjectId, coefficient: d.coefficient });
      report("subjects", r, "create", label, newSubject ? [{ key: "newSubject" }] : []);
    } else if (Math.abs(existing.coefficient - d.coefficient) > 1e-9) {
      plan.curriculumUpdate.push({ id: existing.id, coefficient: d.coefficient });
      report("subjects", r, "update", label, [{ key: "coefficientChanged", params: { from: String(existing.coefficient), to: String(d.coefficient) } }]);
    } else {
      report("subjects", r, "exists", label);
    }
  }

  // --- Salles ----------------------------------------------------------------
  const newRooms = new Set<string>();
  for (const r of book.rooms) {
    const d = r.data;
    const k = normalizeKey(d.name);
    if (r.issues.length) report("rooms", r, "error", d.name);
    else if (newRooms.has(k)) report("rooms", r, "error", d.name, [{ key: "duplicateInFile" }]);
    else if (roomIndex.has(k)) report("rooms", r, "exists", d.name);
    else {
      newRooms.add(k);
      plan.rooms.push({ id: newId(), name: d.name, capacity: d.capacity ? Math.round(d.capacity) : null });
      report("rooms", r, "create", d.name);
    }
  }

  // --- Enseignants -------------------------------------------------------------
  // Même personne = même téléphone, même e-mail, ou même nom et prénom.
  const teacherKeys = new Set<string>();
  for (const t of snap.teachers) {
    teacherKeys.add(`n:${personKey(t.firstName, t.lastName)}`);
    if (t.phone) teacherKeys.add(`p:${t.phone}`);
    if (t.email) teacherKeys.add(`e:${t.email}`);
  }
  const fileTeacherKeys = new Set<string>();
  for (const r of book.teachers) {
    const d = r.data;
    const label = `${d.lastName} ${d.firstName}`.trim();
    if (r.issues.length) {
      report("teachers", r, "error", label);
      continue;
    }
    const keys = [`n:${personKey(d.firstName, d.lastName)}`, d.phone ? `p:${d.phone}` : null, d.email ? `e:${d.email}` : null].filter((k): k is string => !!k);
    if (keys.some((k) => fileTeacherKeys.has(k))) report("teachers", r, "error", label, [{ key: "duplicateInFile" }]);
    else if (keys.some((k) => teacherKeys.has(k))) report("teachers", r, "exists", label);
    else {
      keys.forEach((k) => fileTeacherKeys.add(k));
      plan.teachers.push({ id: newId(), ...d });
      report("teachers", r, "create", label);
    }
  }

  // --- Élèves et parents -------------------------------------------------------
  const studentsByNumber = new Map(snap.students.map((s) => [normalizeKey(s.studentNumber), s]));
  const studentsByName = new Map<string, Snapshot["students"]>();
  for (const s of snap.students) {
    const k = personKey(s.firstName, s.lastName);
    studentsByName.set(k, [...(studentsByName.get(k) ?? []), s]);
  }
  const guardianByContact = new Map<string, string>();
  const guardianName = new Map<string, string>();
  for (const g of snap.guardians) {
    if (g.phone) guardianByContact.set(`p:${g.phone}`, g.id);
    if (g.email) guardianByContact.set(`e:${g.email}`, g.id);
    guardianName.set(g.id, personKey(g.firstName, g.lastName));
  }

  // Matricules automatiques « AAAA-NNN ».
  const usedNumbers = new Set(snap.studentNumbers.map((n) => normalizeKey(n)));
  let seq = snap.studentNumbers.reduce((m, n) => {
    if (!n.startsWith(`${snap.yearPrefix}-`)) return m;
    const v = Number(n.slice(snap.yearPrefix.length + 1));
    return Number.isFinite(v) && v > m ? v : m;
  }, 0);
  const nextNumber = () => {
    let n: string;
    do n = `${snap.yearPrefix}-${String(++seq).padStart(3, "0")}`;
    while (usedNumbers.has(normalizeKey(n)));
    usedNumbers.add(normalizeKey(n));
    return n;
  };

  const fileStudents = new Set<string>();
  for (const r of book.students) {
    const d = r.data;
    const label = `${d.lastName} ${d.firstName}`.trim();
    if (r.issues.length) {
      report("students", r, "error", label);
      continue;
    }

    let classId: string | null = null;
    if (d.className) {
      classId = classIndex.get(normalizeKey(d.className)) ?? null;
      if (!classId) {
        report("students", r, "error", label, [{ key: "classUnknown", params: { value: d.className } }]);
        continue;
      }
    }

    // Doublon dans le fichier lui-même.
    const fileKey = d.studentNumber ? `m:${normalizeKey(d.studentNumber)}` : `n:${personKey(d.firstName, d.lastName)}|${d.birthDate ?? ""}`;
    if (fileStudents.has(fileKey)) {
      report("students", r, "error", label, [{ key: "duplicateInFile" }]);
      continue;
    }
    fileStudents.add(fileKey);

    // Élève déjà dans la plateforme : même matricule, ou même nom et prénom
    // avec la même date de naissance (ou une date manquante d'un côté).
    let existing = d.studentNumber ? studentsByNumber.get(normalizeKey(d.studentNumber)) : undefined;
    if (existing && personKey(existing.firstName, existing.lastName) !== personKey(d.firstName, d.lastName)) {
      report("students", r, "error", label, [{ key: "numberTaken", params: { value: d.studentNumber!, name: `${existing.lastName} ${existing.firstName}` } }]);
      continue;
    }
    if (!existing) {
      existing = (studentsByName.get(personKey(d.firstName, d.lastName)) ?? []).find(
        (s) => !d.birthDate || !s.birthDate || s.birthDate === d.birthDate,
      );
    }

    const notes: Issue[] = [];
    let studentId: string;
    let changed = false;
    let hasPrimary: boolean;
    const linked = new Set<string>();
    const linkedNames = new Set<string>();

    if (existing) {
      studentId = existing.id;
      hasPrimary = existing.hasPrimary;
      existing.guardianIds.forEach((g) => {
        linked.add(g);
        const n = guardianName.get(g);
        if (n) linkedNames.add(n);
      });
      if (classId && !existing.classId) {
        plan.enrollments.push({ studentId, classGroupId: classId });
        existing.classId = classId;
        changed = true;
        notes.push({ key: "enrolled", params: { value: d.className! } });
      } else if (classId && existing.classId !== classId) {
        notes.push({ key: "otherClass" });
      }
    } else {
      studentId = newId();
      hasPrimary = false;
      const studentNumber = d.studentNumber ?? nextNumber();
      usedNumbers.add(normalizeKey(studentNumber));
      plan.students.push({
        id: studentId,
        studentNumber,
        firstName: d.firstName,
        lastName: d.lastName,
        firstNameAr: d.firstNameAr,
        lastNameAr: d.lastNameAr,
        gender: d.gender,
        birthDate: d.birthDate,
        birthPlace: d.birthPlace,
      });
      if (classId) plan.enrollments.push({ studentId, classGroupId: classId });
      // Les lignes suivantes du fichier doivent retrouver cet élève.
      const snapRow = { id: studentId, studentNumber, firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, classId, guardianIds: [] as string[], hasPrimary: false };
      studentsByNumber.set(normalizeKey(studentNumber), snapRow);
    }

    // Parents : même téléphone ou e-mail = même parent (frères et sœurs).
    for (const p of d.parents) {
      const contactKeys = [p.phone ? `p:${p.phone}` : null, p.email ? `e:${p.email}` : null].filter((k): k is string => !!k);
      let guardianId = contactKeys.map((k) => guardianByContact.get(k)).find((x) => x);
      if (guardianId && linked.has(guardianId)) continue;
      if (!guardianId && linkedNames.has(personKey(p.firstName, p.lastName))) continue;
      if (!guardianId) {
        guardianId = newId();
        plan.guardians.push({ id: guardianId, firstName: p.firstName, lastName: p.lastName, phone: p.phone, email: p.email });
        contactKeys.forEach((k) => guardianByContact.set(k, guardianId!));
        guardianName.set(guardianId, personKey(p.firstName, p.lastName));
      }
      plan.links.push({ studentId, guardianId, relationship: p.relationship, isPrimary: !hasPrimary });
      hasPrimary = true;
      linked.add(guardianId);
      linkedNames.add(personKey(p.firstName, p.lastName));
      if (existing) {
        changed = true;
        notes.push({ key: "parentAdded", params: { value: `${p.lastName} ${p.firstName}` } });
      }
    }
    if (existing) existing.hasPrimary = hasPrimary;

    report("students", r, existing ? (changed ? "update" : "exists") : "create", label, notes);
  }

  return plan;
}

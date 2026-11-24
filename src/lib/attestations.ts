/**
 * Textes des attestations délivrées par la direction, en français et en arabe,
 * d'après les modèles de l'école (attestation de présence, de scolarité, de travail).
 * Aucune lecture de la base ici : tout est testé (tests/attestations.test.ts).
 */

export type AttLang = "fr" | "ar";
export type StudentAttestation = "presence" | "scolarite";
export const STUDENT_ATTESTATIONS: StudentAttestation[] = ["presence", "scolarite"];

type Gender = "MALE" | "FEMALE" | null;

export type SchoolInfo = {
  nameFr: string;
  nameAr: string;
  address: string | null;
  addressAr: string | null;
  city: string | null;
  cityAr: string | null;
  directorName: string | null;
  directorNameAr: string | null;
  cycles: readonly string[];
};

export type Level = { code: string; cycle: string; nameFr: string; nameAr: string };

export type Attestation = {
  title: string;
  /** Paragraphes du corps ; `strong` met en gras une partie (nom de la personne). */
  paragraphs: { text: string; strong?: string[] }[];
  place: string;
  signer: string;
  signerName: string | null;
};

const PRIMARY_LEVELS = new Set(["P1", "P2", "P3", "P4", "P5", "P6"]);

/** Date JJ/MM/AAAA (les dates de la base sont à minuit UTC). */
export function shortDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** Nature de l'établissement : « école primaire privée » si l'école n'a que le primaire. */
function schoolKind(school: SchoolInfo, lang: AttLang): string {
  const primaryOnly = school.cycles.length > 0 && school.cycles.every((c) => c === "PRIMARY");
  if (lang === "ar") return primaryOnly ? "المدرسة الابتدائية الخاصّة" : "المؤسسة التربوية الخاصّة";
  return primaryOnly ? "l'école primaire privée" : "l'établissement privé";
}

/** « l'école primaire privée « La Plume d'or » », sans répéter « école » si le nom le contient déjà. */
export function schoolLabel(school: SchoolInfo, lang: AttLang): string {
  if (lang === "ar") {
    return /مدرسة|مؤسسة|معهد/.test(school.nameAr) ? `«${school.nameAr}»` : `${schoolKind(school, "ar")} «${school.nameAr}»`;
  }
  return /école|ecole|établissement|institut|lycée|collège/i.test(school.nameFr)
    ? `l'établissement « ${school.nameFr} »`
    : `${schoolKind(school, "fr")} « ${school.nameFr} »`;
}

/** « 6e année primaire », « السنة السادسة ابتدائي ». */
export function levelLabel(level: Level, lang: AttLang): string {
  const primary = PRIMARY_LEVELS.has(level.code);
  if (lang === "ar") return `${level.nameAr}${primary ? " ابتدائي" : ""}`;
  return `${level.nameFr}${primary ? " primaire" : ""}`;
}

function place(school: SchoolInfo, lang: AttLang, date: Date) {
  if (lang === "ar") {
    const city = school.cityAr || school.city;
    return city ? `${city} في ${shortDate(date)}` : shortDate(date);
  }
  return school.city ? `${school.city}, le ${shortDate(date)}` : `Le ${shortDate(date)}`;
}

const fr = (g: Gender, m: string, f: string, both: string) => (g === "MALE" ? m : g === "FEMALE" ? f : both);

function director(school: SchoolInfo, lang: AttLang) {
  return lang === "ar" ? school.directorNameAr || school.directorName : school.directorName;
}

function whereFr(school: SchoolInfo) {
  return school.address ? `, sise à ${school.address}${school.city && !school.address.includes(school.city) ? ` ${school.city}` : ""}` : "";
}

function whereAr(school: SchoolInfo) {
  return school.cityAr ? ` ب${school.cityAr}` : "";
}

/** « Je soussigné X, directeur de ... » / « إنّي الممضي أسفله X مدير ... ». */
function opening(school: SchoolInfo, lang: AttLang) {
  const name = director(school, lang);
  if (lang === "ar") return `إنّي الممضي أسفله${name ? ` ${name}` : ""} مدير ${schoolLabel(school, "ar")}${whereAr(school)}`;
  return `Je soussigné${name ? ` ${name},` : ""} directeur de ${schoolLabel(school, "fr")}${whereFr(school)}`;
}

export type StudentData = {
  name: string;
  gender: Gender;
  birthDate: Date | null;
  birthPlace: string | null;
};

/** Attestation pour un élève : présence (année en cours) ou scolarité (toutes ses années dans l'école). */
export function studentAttestation(
  kind: StudentAttestation,
  lang: AttLang,
  school: SchoolInfo,
  student: StudentData,
  years: { label: string; level: Level }[],
  date: Date,
): Attestation {
  const g = student.gender;
  const signerName = director(school, lang);
  const current = years.at(-1);

  if (lang === "ar") {
    const pupil = g === "FEMALE" ? "التلميذة" : g === "MALE" ? "التلميذ" : "التلميذ(ة)";
    const born = student.birthDate
      ? ` ${g === "FEMALE" ? "المولودة" : g === "MALE" ? "المولود" : "المولود(ة)"} في ${shortDate(student.birthDate)}${student.birthPlace && /[\u0600-\u06FF]/.test(student.birthPlace) ? ` ب${student.birthPlace}` : ""}`
      : "";
    const pron = g === "FEMALE" ? "لها" : g === "MALE" ? "له" : "له (ها)";
    const guardian = g === "FEMALE" ? "وليّها" : g === "MALE" ? "وليّه" : "وليّه (ها)";
    const affairs = g === "FEMALE" ? "شؤونها" : g === "MALE" ? "شؤونه" : "شؤونه (ها)";
    const closing = { text: `سلّمت ${pron} هذه الشهادة بطلب من ${guardian} لقضاء ${affairs} لدى المصالح المختصّة.` };
    if (kind === "presence") {
      const enrolled = g === "FEMALE" ? "مرسّمة" : g === "MALE" ? "مرسّم" : "مرسّم(ة)";
      return {
        title: "شهادة حضور",
        paragraphs: [
          {
            text: `${opening(school, "ar")}، أشهد بأنّ ${pupil} «${student.name}»${born} ${enrolled} ب${current ? levelLabel(current.level, "ar") : "…"} خلال السنة الدراسية ${current?.label ?? "…"} ويزاول دراسته بالمدرسة المذكورة.`,
            strong: [student.name],
          },
          closing,
        ],
        place: place(school, "ar", date),
        signer: "المدير",
        signerName,
      };
    }
    const was = g === "FEMALE" ? "كانت مرسّمة" : g === "MALE" ? "كان مرسّما" : "كان(ت) مرسّما(ة)";
    return {
      title: "شهادة مدرسية",
      paragraphs: [
        {
          text: `${opening(school, "ar")}، أشهد بأنّ ${pupil} «${student.name}»${born} ${was} بمدرستنا بصفة منتظمة خلال السنوات الدراسية التالية: ${years.map((y) => `${levelLabel(y.level, "ar")} (${y.label})`).join("، ")}.`,
          strong: [student.name],
        },
        closing,
      ],
      place: place(school, "ar", date),
      signer: "المدير",
      signerName,
    };
  }

  const pupil = "l'élève";
  const born = student.birthDate
    ? `, ${fr(g, "né", "née", "né(e)")} le ${shortDate(student.birthDate)}${student.birthPlace ? ` à ${student.birthPlace}` : ""}`
    : "";
  const closing = { text: `Cette attestation est délivrée à la demande de l'${fr(g, "intéressé", "intéressée", "intéressé(e)")} pour servir et valoir ce que de droit.` };
  if (kind === "presence") {
    return {
      title: "Attestation de présence",
      paragraphs: [
        {
          text: `${opening(school, "fr")}, atteste par la présente que ${pupil} ${student.name}${born}, est ${fr(g, "inscrit", "inscrite", "inscrit(e)")} en ${current ? levelLabel(current.level, "fr") : "…"} et poursuit actuellement (${current?.label ?? "…"}) ses études dans notre établissement.`,
          strong: [student.name],
        },
        closing,
      ],
      place: place(school, "fr", date),
      signer: "Le directeur",
      signerName,
    };
  }
  return {
    title: "Attestation scolaire",
    paragraphs: [
      {
        text: `${opening(school, "fr")}, atteste par la présente que ${pupil} ${student.name}${born}, a été régulièrement ${fr(g, "inscrit", "inscrite", "inscrit(e)")} dans notre établissement pour les années scolaires suivantes : ${years.map((y) => `${levelLabel(y.level, "fr")} (${y.label})`).join(", ")}.`,
        strong: [student.name],
      },
      closing,
    ],
    place: place(school, "fr", date),
    signer: "Le directeur",
    signerName,
  };
}

export type TeacherData = {
  name: string;
  gender: Gender;
  cin: string | null;
  hiredOn: Date | null;
  /** Matières enseignées (dans la langue de l'attestation), d'après l'emploi du temps. */
  subjects: string[];
};

/** Attestation de travail d'un enseignant. */
export function workAttestation(lang: AttLang, school: SchoolInfo, teacher: TeacherData, date: Date): Attestation {
  const g = teacher.gender;
  const signerName = director(school, lang);
  if (lang === "ar") {
    const who = g === "FEMALE" ? "السيّدة" : g === "MALE" ? "السيّد" : "السيّد(ة)";
    const owner = g === "FEMALE" ? "صاحبة" : g === "MALE" ? "صاحب" : "صاحب(ة)";
    const works = g === "FEMALE" ? "تعمل مدرّسة" : g === "MALE" ? "يعمل مدرّسا" : "يعمل(تعمل) مدرّسا(ة)";
    const pron = g === "FEMALE" ? "لها" : g === "MALE" ? "له" : "له (ها)";
    const req = g === "FEMALE" ? "منها" : g === "MALE" ? "منه" : "منه (ها)";
    return {
      title: "شهادة عمل",
      paragraphs: [
        {
          text: `${opening(school, "ar")}، أشهد بأنّ ${who} «${teacher.name}»${teacher.cin ? ` ${owner} بطاقة التعريف الوطنية عدد ${teacher.cin}` : ""} ${works} بالمؤسسة المذكورة${teacher.hiredOn ? ` منذ ${shortDate(teacher.hiredOn)}` : ""}${teacher.subjects.length ? `، ${g === "FEMALE" ? "وتدرّس" : "ويدرّس"} ${teacher.subjects.join(" و")}` : ""}.`,
          strong: [teacher.name],
        },
        { text: `سلّمت ${pron} هذه الشهادة بطلب ${req} للإدلاء بها لدى السّلط المعنية.` },
      ],
      place: place(school, "ar", date),
      signer: "المدير",
      signerName,
    };
  }
  const civ = fr(g, "M.", "Mme", "M./Mme");
  return {
    title: "Attestation de travail",
    paragraphs: [
      {
        text: `${opening(school, "fr")}, atteste par la présente que ${civ} ${teacher.name}${teacher.cin ? `, titulaire de la CIN n° ${teacher.cin},` : ""} est ${fr(g, "enseignant", "enseignante", "enseignant(e)")} dans notre établissement${teacher.hiredOn ? ` depuis le ${shortDate(teacher.hiredOn)}` : ""}${teacher.subjects.length ? ` (${teacher.subjects.join(", ")})` : ""}.`,
        strong: [teacher.name],
      },
      { text: `Cette attestation est délivrée à la demande de l'${fr(g, "intéressé", "intéressée", "intéressé(e)")} pour valoir et servir aux autorités concernées.` },
    ],
    place: place(school, "fr", date),
    signer: "Le directeur",
    signerName,
  };
}

/** Nom de l'école pour l'en-tête : « École primaire privée « X » » (sans répétition si le nom le dit déjà). */
export function schoolTitle(school: SchoolInfo, lang: AttLang): string {
  const label = schoolLabel(school, lang);
  if (lang === "ar") return label.startsWith("«") ? school.nameAr : label;
  return label.startsWith("l'établissement « ") ? school.nameFr : label.charAt(2).toUpperCase() + label.slice(3);
}

import { normalizePhone } from "@/lib/phone";
import { SHEETS, type SheetDef, type SheetKey } from "./schema";

/** Valeur brute d'une case Excel, déjà simplifiée. */
export type Cell = string | number | boolean | Date | null;

/** Problème sur une ligne, traduit à l'affichage (clé de `importer.errors`). */
export type Issue = { key: string; params?: Record<string, string> };

/** Une ligne du fichier, lue et vérifiée. */
export type ParsedRow<T> = { row: number; data: T; issues: Issue[] };

// ---------------------------------------------------------------------------
// Normalisation (pour comparer des textes saisis à la main)
// ---------------------------------------------------------------------------

/**
 * Forme comparable d'un texte : minuscules, sans accents ni ponctuation,
 * lettres arabes unifiées (أ إ آ → ا, ة → ه, ى → ي, sans voyelles),
 * « 1re », « 1ère », « 1er » → « 1 ».
 */
export function normalizeKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/(\d+)\s*(ere|er|re|eme|e|ème)\b/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Texte d'une case ("" si vide). Les nombres entiers restent sans virgule. */
export function cellText(v: Cell | undefined): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Lecture des valeurs
// ---------------------------------------------------------------------------

/** Date de naissance : case date d'Excel, « 12/03/2018 », « 12-03-2018 » ou « 2018-03-12 ». */
export function parseDate(v: Cell | undefined): string | null | "invalid" {
  if (v == null || v === "") return null;
  let y: number, m: number, d: number;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "invalid";
    // Excel enregistre les dates à minuit UTC ; on ajoute 12 h pour éviter
    // un décalage d'un jour lié au fuseau horaire.
    const t = new Date(v.getTime() + 12 * 3600 * 1000);
    [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  } else if (typeof v === "number") {
    // Numéro de série Excel (jours depuis le 30/12/1899).
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  } else {
    const s = cellText(v);
    let match = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (match) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    else return "invalid";
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  if (y < 1940 || date.getTime() > Date.now()) return "invalid";
  return date.toISOString().slice(0, 10);
}

const GENDERS: Record<string, "MALE" | "FEMALE"> = {
  g: "MALE", m: "MALE", garcon: "MALE", masculin: "MALE", h: "MALE", homme: "MALE", ذ: "MALE", ذكر: "MALE", ولد: "MALE",
  f: "FEMALE", fille: "FEMALE", feminin: "FEMALE", femme: "FEMALE", ا: "FEMALE", انثي: "FEMALE", بنت: "FEMALE",
};

export function parseGender(v: Cell | undefined): "MALE" | "FEMALE" | null | "invalid" {
  const s = normalizeKey(cellText(v));
  if (!s) return null;
  return GENDERS[s] ?? "invalid";
}

type Relationship = "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER";
const RELATIONSHIPS: Record<string, Relationship> = {
  pere: "FATHER", p: "FATHER", papa: "FATHER", ab: "FATHER", اب: "FATHER", الاب: "FATHER", والد: "FATHER",
  mere: "MOTHER", maman: "MOTHER", ام: "MOTHER", الام: "MOTHER", والده: "MOTHER",
  tuteur: "GUARDIAN", tutrice: "GUARDIAN", t: "GUARDIAN", ولي: "GUARDIAN", الولي: "GUARDIAN", وليه: "GUARDIAN",
  autre: "OTHER", اخر: "OTHER", اخري: "OTHER",
};

export function parseRelationship(v: Cell | undefined): Relationship | null | "invalid" {
  const s = normalizeKey(cellText(v));
  if (!s) return null;
  return RELATIONSHIPS[s] ?? "invalid";
}

/** Nombre positif (accepte la virgule décimale). */
export function parseNumber(v: Cell | undefined): number | null | "invalid" {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(cellText(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : "invalid";
}

function parsePhone(v: Cell | undefined): string | null | "invalid" {
  const s = cellText(v);
  if (!s) return null;
  return normalizePhone(s) ?? "invalid";
}

function parseEmail(v: Cell | undefined): string | null | "invalid" {
  const s = cellText(v).toLowerCase();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "invalid";
}

// ---------------------------------------------------------------------------
// Repérage des feuilles et des colonnes
// ---------------------------------------------------------------------------

/** Retrouve la feuille correspondant à un nom d'onglet (français, arabe ou les deux). */
export function matchSheet(tabName: string): SheetKey | null {
  const n = normalizeKey(tabName);
  for (const s of SHEETS) {
    const fr = normalizeKey(s.fr);
    const ar = normalizeKey(s.ar);
    if (n === fr || n === ar || n.startsWith(`${fr} `) || n.endsWith(` ${ar}`)) return s.key;
  }
  // Variantes courantes.
  const aliases: Record<string, SheetKey> = { eleves: "students", eleve: "students", enseignant: "teachers", professeurs: "teachers", salle: "rooms", classe: "classes", matiere: "subjects" };
  return aliases[n.split(" ")[0]] ?? null;
}

/**
 * Indique, pour chaque colonne attendue, sa position dans la feuille.
 * On reconnaît l'en-tête en français ou en arabe ; si l'en-tête n'est pas
 * reconnu, on suppose que les colonnes sont dans l'ordre du modèle.
 */
export function mapColumns(def: SheetDef, header: Cell[]): Record<string, number> {
  const found: Record<string, number> = {};
  header.forEach((cell, i) => {
    const parts = String(cell ?? "")
      .split(/\r?\n|\s\/\s/)
      .map((l) => normalizeKey(l))
      .filter(Boolean);
    const col = def.columns.find(
      (c) => !(c.key in found) && parts.some((x) => x === normalizeKey(c.fr) || x === normalizeKey(c.ar)),
    );
    if (col) found[col.key] = i;
  });
  if (def.columns.filter((c) => c.required).every((c) => c.key in found)) return found;
  return Object.fromEntries(def.columns.map((c, i) => [c.key, i]));
}

// ---------------------------------------------------------------------------
// Lecture des lignes de chaque feuille
// ---------------------------------------------------------------------------

export type ClassRow = { name: string; nameAr: string | null; level: string; track: string | null; capacity: number | null };
export type SubjectRow = { level: string; subject: string; subjectAr: string | null; coefficient: number; track: string | null };
export type RoomRow = { name: string; capacity: number | null };
export type PersonRow = { lastName: string; firstName: string; lastNameAr: string | null; firstNameAr: string | null; phone: string | null; email: string | null };
export type ParentInput = { relationship: Relationship; lastName: string; firstName: string; phone: string | null; email: string | null };
export type StudentRow = {
  studentNumber: string | null;
  lastName: string;
  firstName: string;
  lastNameAr: string | null;
  firstNameAr: string | null;
  gender: "MALE" | "FEMALE" | null;
  birthDate: string | null;
  birthPlace: string | null;
  className: string | null;
  parents: ParentInput[];
};

export type ParsedWorkbook = {
  classes: ParsedRow<ClassRow>[];
  subjects: ParsedRow<SubjectRow>[];
  rooms: ParsedRow<RoomRow>[];
  teachers: ParsedRow<PersonRow>[];
  students: ParsedRow<StudentRow>[];
  /** Feuilles trouvées dans le fichier. */
  found: SheetKey[];
};

/** Lecteur d'une ligne : renvoie le texte d'une colonne et note les problèmes. */
function rowReader(def: SheetDef, cols: Record<string, number>, cells: Cell[], issues: Issue[]) {
  const label = (key: string) => def.columns.find((c) => c.key === key)!;
  const raw = (key: string) => (cols[key] === undefined ? null : (cells[cols[key]] ?? null));
  const text = (key: string, max = 120) => {
    const t = cellText(raw(key));
    if (t.length > max) {
      issues.push({ key: "tooLong", params: { column: label(key).fr } });
      return t.slice(0, max);
    }
    return t;
  };
  const required = (key: string) => {
    const t = text(key);
    if (!t) issues.push({ key: "required", params: { column: label(key).fr } });
    return t;
  };
  const optional = (key: string) => text(key) || null;
  const check = <V>(key: string, value: V | "invalid", issue: string): V | null => {
    if (value === "invalid") {
      issues.push({ key: issue, params: { column: label(key).fr, value: cellText(raw(key)) } });
      return null;
    }
    return value;
  };
  return { raw, required, optional, check };
}

function isEmptyRow(cells: Cell[]) {
  return cells.every((c) => cellText(c) === "");
}

/** Lit toutes les feuilles reconnues du fichier (en-tête sur la ligne 1). */
export function parseWorkbook(sheets: { name: string; rows: Cell[][] }[]): ParsedWorkbook {
  const out: ParsedWorkbook = { classes: [], subjects: [], rooms: [], teachers: [], students: [], found: [] };

  for (const sheet of sheets) {
    const key = matchSheet(sheet.name);
    if (!key || out.found.includes(key)) continue;
    out.found.push(key);
    const def = SHEETS.find((s) => s.key === key)!;
    const cols = mapColumns(def, sheet.rows[0] ?? []);

    sheet.rows.slice(1).forEach((cells, i) => {
      if (!cells || isEmptyRow(cells)) return;
      const row = i + 2;
      const issues: Issue[] = [];
      const r = rowReader(def, cols, cells, issues);

      if (key === "classes") {
        out.classes.push({
          row,
          issues,
          data: {
            name: r.required("name"),
            nameAr: r.optional("nameAr"),
            level: r.required("level"),
            track: r.optional("track"),
            capacity: r.check("capacity", parseNumber(r.raw("capacity")), "numberInvalid"),
          },
        });
      } else if (key === "subjects") {
        const coefficient = r.check("coefficient", parseNumber(r.raw("coefficient")), "numberInvalid");
        if (coefficient === null && !issues.length) issues.push({ key: "required", params: { column: "Coefficient" } });
        if (coefficient !== null && coefficient > 20) issues.push({ key: "numberInvalid", params: { column: "Coefficient", value: String(coefficient) } });
        out.subjects.push({
          row,
          issues,
          data: {
            level: r.required("level"),
            subject: r.required("subject"),
            subjectAr: r.optional("subjectAr"),
            coefficient: coefficient ?? 1,
            track: r.optional("track"),
          },
        });
      } else if (key === "rooms") {
        out.rooms.push({
          row,
          issues,
          data: { name: r.required("name"), capacity: r.check("capacity", parseNumber(r.raw("capacity")), "numberInvalid") },
        });
      } else if (key === "teachers") {
        out.teachers.push({
          row,
          issues,
          data: {
            lastName: r.required("lastName"),
            firstName: r.required("firstName"),
            lastNameAr: r.optional("lastNameAr"),
            firstNameAr: r.optional("firstNameAr"),
            phone: r.check("phone", parsePhone(r.raw("phone")), "phoneInvalid"),
            email: r.check("email", parseEmail(r.raw("email")), "emailInvalid"),
          },
        });
      } else {
        const parents: ParentInput[] = [];
        for (const p of ["p1", "p2"] as const) {
          const lastName = r.optional(`${p}LastName`);
          const firstName = r.optional(`${p}FirstName`);
          const phone = r.check(`${p}Phone`, parsePhone(r.raw(`${p}Phone`)), "phoneInvalid");
          const email = p === "p1" ? r.check(`${p}Email`, parseEmail(r.raw(`${p}Email`)), "emailInvalid") : null;
          const relationship = r.check(`${p}Relationship`, parseRelationship(r.raw(`${p}Relationship`)), "relationshipInvalid");
          const anything = [`${p}LastName`, `${p}FirstName`, `${p}Phone`, `${p}Email`].some((k) => cellText(r.raw(k)) !== "");
          if (!anything) continue;
          if (!firstName) {
            issues.push({ key: "parentNameMissing", params: { parent: p === "p1" ? "1" : "2" } });
            continue;
          }
          parents.push({
            relationship: relationship ?? (p === "p1" ? "FATHER" : "MOTHER"),
            // Sans nom de famille, on reprend celui de l'élève.
            lastName: lastName ?? cellText(r.raw("lastName")),
            firstName,
            phone,
            email,
          });
        }
        out.students.push({
          row,
          issues,
          data: {
            studentNumber: r.optional("studentNumber"),
            lastName: r.required("lastName"),
            firstName: r.required("firstName"),
            lastNameAr: r.optional("lastNameAr"),
            firstNameAr: r.optional("firstNameAr"),
            gender: r.check("gender", parseGender(r.raw("gender")), "genderInvalid"),
            birthDate: r.check("birthDate", parseDate(r.raw("birthDate")), "dateInvalid"),
            birthPlace: r.optional("birthPlace"),
            className: r.optional("className"),
            parents,
          },
        });
      }
    });
  }
  return out;
}

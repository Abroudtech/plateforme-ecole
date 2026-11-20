/**
 * Description des feuilles du fichier Excel d'import (modèle à télécharger).
 * Les en-têtes sont bilingues : « Nom » sur la première ligne de la case,
 * « اللقب » sur la seconde. L'ordre des feuilles est aussi l'ordre d'import :
 * les classes doivent exister avant d'y inscrire des élèves.
 */

export const SHEET_KEYS = ["classes", "subjects", "rooms", "teachers", "students"] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export type Column = {
  key: string;
  fr: string;
  ar: string;
  required?: boolean;
  /** Largeur de la colonne dans le modèle. */
  width?: number;
  /** Format texte forcé (téléphones, matricules : évite « 2,2E+07 »). */
  text?: boolean;
};

export type SheetDef = { key: SheetKey; fr: string; ar: string; columns: Column[] };

export const SHEETS: SheetDef[] = [
  {
    key: "classes",
    fr: "Classes",
    ar: "الأقسام",
    columns: [
      { key: "name", fr: "Nom de la classe", ar: "اسم القسم", required: true, width: 18, text: true },
      { key: "nameAr", fr: "Nom en arabe", ar: "الاسم بالعربية", width: 18 },
      { key: "level", fr: "Niveau", ar: "المستوى", required: true, width: 26 },
      { key: "track", fr: "Filière (lycée)", ar: "الشعبة (ثانوي)", width: 20 },
      { key: "capacity", fr: "Places", ar: "عدد المقاعد", width: 12 },
    ],
  },
  {
    key: "subjects",
    fr: "Matières",
    ar: "المواد",
    columns: [
      { key: "level", fr: "Niveau", ar: "المستوى", required: true, width: 26 },
      { key: "subject", fr: "Matière", ar: "المادة", required: true, width: 28 },
      { key: "subjectAr", fr: "Matière en arabe", ar: "المادة بالعربية", width: 24 },
      { key: "coefficient", fr: "Coefficient", ar: "الضارب", required: true, width: 13 },
      { key: "track", fr: "Filière (lycée)", ar: "الشعبة (ثانوي)", width: 20 },
    ],
  },
  {
    key: "rooms",
    fr: "Salles",
    ar: "القاعات",
    columns: [
      { key: "name", fr: "Nom de la salle", ar: "اسم القاعة", required: true, width: 22, text: true },
      { key: "capacity", fr: "Places", ar: "عدد المقاعد", width: 12 },
    ],
  },
  {
    key: "teachers",
    fr: "Enseignants",
    ar: "المدرّسون",
    columns: [
      { key: "lastName", fr: "Nom", ar: "اللقب", required: true, width: 18 },
      { key: "firstName", fr: "Prénom", ar: "الاسم", required: true, width: 18 },
      { key: "lastNameAr", fr: "Nom en arabe", ar: "اللقب بالعربية", width: 18 },
      { key: "firstNameAr", fr: "Prénom en arabe", ar: "الاسم بالعربية", width: 18 },
      { key: "phone", fr: "Téléphone", ar: "الهاتف", width: 16, text: true },
      { key: "email", fr: "E-mail", ar: "البريد الإلكتروني", width: 26 },
    ],
  },
  {
    key: "students",
    fr: "Élèves",
    ar: "التلاميذ",
    columns: [
      { key: "studentNumber", fr: "Matricule", ar: "المعرّف", width: 13, text: true },
      { key: "lastName", fr: "Nom", ar: "اللقب", required: true, width: 18 },
      { key: "firstName", fr: "Prénom", ar: "الاسم", required: true, width: 18 },
      { key: "lastNameAr", fr: "Nom en arabe", ar: "اللقب بالعربية", width: 18 },
      { key: "firstNameAr", fr: "Prénom en arabe", ar: "الاسم بالعربية", width: 18 },
      { key: "gender", fr: "Sexe (G/F)", ar: "الجنس (ذ/أ)", width: 11 },
      { key: "birthDate", fr: "Date de naissance", ar: "تاريخ الولادة", width: 16 },
      { key: "birthPlace", fr: "Lieu de naissance", ar: "مكان الولادة", width: 18 },
      { key: "className", fr: "Classe", ar: "القسم", width: 14, text: true },
      { key: "p1Relationship", fr: "Parent 1 : lien", ar: "الولي 1 : الصفة", width: 16 },
      { key: "p1LastName", fr: "Parent 1 : nom", ar: "الولي 1 : اللقب", width: 18 },
      { key: "p1FirstName", fr: "Parent 1 : prénom", ar: "الولي 1 : الاسم", width: 18 },
      { key: "p1Phone", fr: "Parent 1 : téléphone", ar: "الولي 1 : الهاتف", width: 18, text: true },
      { key: "p1Email", fr: "Parent 1 : e-mail", ar: "الولي 1 : البريد", width: 24 },
      { key: "p2Relationship", fr: "Parent 2 : lien", ar: "الولي 2 : الصفة", width: 16 },
      { key: "p2LastName", fr: "Parent 2 : nom", ar: "الولي 2 : اللقب", width: 18 },
      { key: "p2FirstName", fr: "Parent 2 : prénom", ar: "الولي 2 : الاسم", width: 18 },
      { key: "p2Phone", fr: "Parent 2 : téléphone", ar: "الولي 2 : الهاتف", width: 18, text: true },
    ],
  },
];

export function sheetDef(key: SheetKey): SheetDef {
  return SHEETS.find((s) => s.key === key)!;
}

/** Nom de l'onglet dans Excel (31 caractères au plus). */
export function sheetTabName(def: SheetDef) {
  return `${def.fr} - ${def.ar}`;
}

/** Choix proposés dans les listes déroulantes du modèle. */
export const GENDER_CHOICES = ["G", "F"];
export const RELATIONSHIP_CHOICES = ["Père", "Mère", "Tuteur", "Autre"];

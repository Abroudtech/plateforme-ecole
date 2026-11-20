import "server-only";
import ExcelJS from "exceljs";
import type { Cell } from "./parse";
import { GENDER_CHOICES, RELATIONSHIP_CHOICES, SHEETS, sheetDef, sheetTabName, type SheetKey } from "./schema";

/** Valeur simple d'une case (texte enrichi, formule, lien...). */
function simplify(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return simplify(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return String(v);
}

/** Lit un fichier .xlsx : chaque feuille devient un tableau de lignes. */
export async function readWorkbook(buffer: ArrayBuffer): Promise<{ name: string; rows: Cell[][] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets
    .filter((ws) => ws.state === "visible")
    .map((ws) => {
      const rows: Cell[][] = [];
      // Au plus 3 000 lignes par feuille : largement assez pour une école.
      const last = Math.min(ws.rowCount, 3000);
      for (let i = 1; i <= last; i++) {
        const row = ws.getRow(i);
        const cells: Cell[] = [];
        for (let c = 1; c <= Math.min(row.cellCount, 40); c++) cells.push(simplify(row.getCell(c).value));
        rows.push(cells);
      }
      return { name: ws.name, rows };
    });
}

export type TemplateData = {
  schoolName: string;
  levels: string[];
  tracks: string[];
  /** Lignes déjà connues de la plateforme, pré-remplies dans le modèle. */
  prefill: Partial<Record<SheetKey, (string | number | null)[][]>>;
};

const BLUE = "FF1D4ED8";
const LIGHT = "FFDBEAFE";
const GREY = "FFF1F5F9";

/**
 * Fabrique le modèle Excel à remplir : une feuille d'explications, puis une
 * feuille par type de données, avec en-têtes bilingues et listes de choix.
 */
export async function buildTemplate(data: TemplateData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plateforme École";
  wb.created = new Date();

  // --- Mode d'emploi -------------------------------------------------------
  const help = wb.addWorksheet("Lisez-moi - اقرأني", { properties: { tabColor: { argb: BLUE } } });
  help.getColumn(1).width = 70;
  help.getColumn(2).width = 60;
  const lines: [string, string][] = [
    [`Import des données de ${data.schoolName}`, "استيراد بيانات المدرسة"],
    ["", ""],
    ["1. Remplissez les onglets dans l'ordre : Classes, Matières, Salles, Enseignants, Élèves.", "1. املؤوا الأوراق بالترتيب : الأقسام، المواد، القاعات، المدرّسون، التلاميذ."],
    ["2. Une ligne = une classe, une matière, une salle, un enseignant ou un élève.", "2. سطر واحد = قسم أو مادة أو قاعة أو مدرّس أو تلميذ."],
    ["3. Les colonnes en bleu foncé sont obligatoires. Les autres peuvent rester vides.", "3. الأعمدة باللون الأزرق الداكن إجبارية، والبقية اختيارية."],
    ["4. Ne changez pas les titres des colonnes ni les noms des onglets.", "4. لا تغيّروا عناوين الأعمدة ولا أسماء الأوراق."],
    ["5. Les lignes déjà présentes dans la plateforme sont pré-remplies : laissez-les, elles seront ignorées.", "5. الأسطر الموجودة مسبقًا في المنصة معبّأة: اتركوها، لن تُضاف مرة ثانية."],
    ["6. Vous pouvez renvoyer le même fichier plusieurs fois : rien n'est créé en double, rien n'est supprimé.", "6. يمكن إرسال نفس الملف أكثر من مرة: لا يُضاف شيء مرتين ولا يُحذف شيء."],
    ["", ""],
    ["Élèves", "التلاميذ"],
    ["• Classe : choisissez dans la liste (les classes de l'onglet Classes).", "• القسم : اختاروا من القائمة (أقسام ورقة الأقسام)."],
    ["• Matricule : facultatif, il est créé automatiquement.", "• المعرّف : اختياري، يُنشأ آليًا."],
    ["• Sexe : G (garçon) ou F (fille).", "• الجنس : G (ذكر) أو F (أنثى)."],
    ["• Date de naissance : JJ/MM/AAAA, par exemple 15/03/2019.", "• تاريخ الولادة : يوم/شهر/سنة، مثلا 15/03/2019."],
    ["• Parents : lien Père, Mère, Tuteur ou Autre ; téléphone à 8 chiffres.", "• الولي : أب، أم، ولي أو آخر ؛ الهاتف 8 أرقام."],
    ["• Deux frères et sœurs avec le même téléphone de parent auront le même parent.", "• الإخوة الذين لهم نفس هاتف الولي يُربطون بنفس الولي."],
    ["", ""],
    ["Exemple de ligne élève :", "مثال لسطر تلميذ :"],
    ["Ben Salah | Yasmine | بن صالح | ياسمين | F | 15/03/2019 | Moknine | 1A | Père | Ben Salah | Karim | 22 123 456", ""],
  ];
  lines.forEach(([fr, ar], i) => {
    const row = help.getRow(i + 1);
    row.getCell(1).value = fr;
    row.getCell(2).value = ar;
    row.getCell(2).alignment = { horizontal: "right", readingOrder: "rtl", wrapText: true };
    row.getCell(1).alignment = { wrapText: true };
    if (i === 0 || fr === "Élèves") row.font = { bold: true, size: i === 0 ? 14 : 12 };
  });

  // --- Listes de choix (onglet caché) ---------------------------------------
  const lists = wb.addWorksheet("Listes", { state: "hidden" });
  const listColumn = (col: number, values: string[]) => {
    values.forEach((v, i) => (lists.getCell(i + 1, col).value = v));
    const letter = String.fromCharCode(64 + col);
    return `Listes!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`;
  };
  const levelRange = listColumn(1, data.levels);
  const trackRange = data.tracks.length ? listColumn(2, data.tracks) : null;
  const genderRange = listColumn(3, GENDER_CHOICES);
  const relRange = listColumn(4, RELATIONSHIP_CHOICES);

  const MAX_ROWS = 1000;
  const classTab = sheetTabName(sheetDef("classes"));

  for (const def of SHEETS) {
    // Les filières ne servent qu'au lycée.
    const columns = data.tracks.length ? def.columns : def.columns.filter((c) => c.key !== "track");
    const ws = wb.addWorksheet(sheetTabName(def), { views: [{ state: "frozen", ySplit: 1 }] });
    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width ?? 16;
      if (c.text) col.numFmt = "@";
      const cell = ws.getCell(1, i + 1);
      cell.value = `${c.fr}${c.required ? " *" : ""}\n${c.ar}`;
      cell.font = { bold: true, color: { argb: c.required ? "FFFFFFFF" : "FF0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? BLUE : LIGHT } };
      cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
    });
    ws.getRow(1).height = 36;

    (data.prefill[def.key] ?? []).forEach((values, r) => {
      const row = ws.getRow(r + 2);
      columns.forEach((c, i) => {
        const v = values[def.columns.indexOf(c)];
        if (v != null) row.getCell(i + 1).value = v;
      });
      row.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } }));
    });

    // Listes déroulantes (avertissement seulement : on peut taper autre chose).
    const choose = (key: string, range: string | null) => {
      const idx = columns.findIndex((c) => c.key === key);
      if (idx < 0 || !range) return;
      for (let r = 2; r <= MAX_ROWS; r++) {
        ws.getCell(r, idx + 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [range],
          showErrorMessage: true,
          errorStyle: "warning",
          error: "Valeur absente de la liste / قيمة غير موجودة في القائمة",
        };
      }
    };
    choose("level", levelRange);
    choose("track", trackRange);
    choose("gender", genderRange);
    choose("p1Relationship", relRange);
    choose("p2Relationship", relRange);
    choose("className", `'${classTab}'!$A$2:$A$${MAX_ROWS}`);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

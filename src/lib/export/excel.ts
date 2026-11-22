import "server-only";
import ExcelJS from "exceljs";

export type ExportColumn = { header: string; width?: number; money?: boolean; date?: boolean };
export type ExportCell = string | number | Date | null | undefined;

/**
 * Fabrique un fichier Excel simple : une feuille, une ligne d'en-têtes en
 * couleur, filtres automatiques. Les montants sont en dinars (3 décimales).
 */
export async function buildExport(sheetName: string, columns: ExportColumn[], rows: ExportCell[][], rtl = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ma Plume";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1, rightToLeft: rtl }] });
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(12, c.header.length + 4),
    style: c.money ? { numFmt: "#,##0.000" } : c.date ? { numFmt: "dd/mm/yyyy" } : {},
  }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14234B" } };
  for (const r of rows) ws.addRow(r.map((v, i) => (columns[i]?.money && typeof v === "number" ? v / 1000 : (v ?? null))));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

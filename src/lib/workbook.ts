import ExcelJS from "exceljs";
import { createDemoState } from "./demo-data";
import type { EntityName, LibraryState } from "./domain";

export const workbookTables: { name: EntityName; tableName: string; columns: string[] }[] = [
  { name: "books", tableName: "Books", columns: ["id", "version", "title", "author", "year", "ddc", "kdc", "classIndex", "locationId", "shelfId", "bin", "coverColor", "demo"] },
  { name: "shelves", tableName: "Shelves", columns: ["id", "version", "name", "locationId", "zone", "floor", "capacity"] },
  { name: "locations", tableName: "Locations", columns: ["id", "version", "name", "floor", "zone"] },
  { name: "users", tableName: "Users", columns: ["id", "version", "authId", "displayName", "email", "role"] },
  { name: "loans", tableName: "Loans", columns: ["id", "version", "bookId", "userId", "status", "requestedAt", "approvedAt", "dueAt", "returnedAt"] },
  { name: "reservations", tableName: "Reservations", columns: ["id", "version", "bookId", "userId", "status", "createdAt"] },
  { name: "settings", tableName: "Settings", columns: ["id", "version", "key", "value"] },
];

export function normalizeDemoBookCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(500, Math.trunc(value!)) : 520;
}

export function createWorkbook(state: LibraryState = createDemoState()): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "3D Library Excel Demo";
  const fixtureDate = new Date("2026-01-01T00:00:00.000Z");
  workbook.created = fixtureDate;
  workbook.modified = fixtureDate;
  for (const definition of workbookTables) {
    const sheet = workbook.addWorksheet(definition.tableName);
    sheet.properties.defaultRowHeight = 18;
    const rows = state[definition.name] as Record<string, unknown>[];
    sheet.addTable({
      name: definition.tableName,
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: definition.columns.map((name) => ({ name })),
      rows: rows.map((row) => definition.columns.map((column) => row[column] ?? "")),
    });
    definition.columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = Math.max(column.length + 2, Math.min(28, String(rows[0]?.[column] ?? "").length + 2));
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).height = 24;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const readme = workbook.addWorksheet("START_HERE", { properties: { tabColor: { argb: "FFC56B4A" } } });
  readme.columns = [{ width: 28 }, { width: 100 }];
  readme.addRows([
    ["3D LIBRARY EXCEL WORKBOOK", "SYNTHETIC DEMO DATA - no real book metadata"],
    ["Schema version", "1"],
    ["Source of truth", "Excel tables in this workbook; no SharePoint sync is active"],
    ["Important", "Do not rename tables or headers. Do not edit row IDs. Version columns detect conflicts."],
    ["Generated books", String(state.books.length)],
    ["Classes", "DDC/KDC broad classes 0 through 9"],
  ]);
  readme.getRow(1).font = { bold: true, size: 16 };
  readme.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC56B4A" } };
  readme.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  return workbook;
}

import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo-data";
import { libraryStateSchema } from "./domain";
import { createWorkbook, normalizeDemoBookCount, workbookTables } from "./workbook";

describe("synthetic workbook generator", () => {
  it("creates 520 varied, valid records with all required tables", async () => {
    const state = createDemoState(520, new Date("2026-01-01"));
    expect(() => libraryStateSchema.parse(state)).not.toThrow();
    expect(state.books).toHaveLength(520);
    expect(new Set(state.books.map((book) => book.id)).size).toBe(520);
    expect(new Set(state.books.map((book) => book.title)).size).toBeGreaterThan(100);
    expect(new Set(state.books.map((book) => book.classIndex))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(state.books.every((book) => book.demo && book.ddc && book.kdc && book.titleKo && book.authorKo)).toBe(true);
    expect(state.books[0].titleKo).toBe("사라진 지도의 기록");

    const workbook = createWorkbook(state);
    expect(workbookTables.find((table) => table.name === "books")?.columns).toEqual(expect.arrayContaining(["titleKo", "authorKo"]));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Books", "Shelves", "Locations", "Users", "Loans", "Reservations", "Settings", "START_HERE",
    ]);
    for (const table of workbookTables) {
      expect(workbook.getWorksheet(table.tableName)?.getTable(table.tableName)).toBeDefined();
    }
    expect(workbook.getWorksheet("Books")?.actualRowCount).toBe(521);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(50_000);
  });

  it("enforces the 500-book minimum for command-line generation", () => {
    expect(normalizeDemoBookCount(2)).toBe(500);
    expect(normalizeDemoBookCount(undefined)).toBe(520);
  });

  it("rejects duplicate IDs and broken stable relationships", () => {
    const state = createDemoState(500);
    state.books[1].id = state.books[0].id;
    expect(() => libraryStateSchema.parse(state)).toThrow(/Duplicate stable id/);
    const broken = createDemoState(500);
    broken.books[0].locationId = "missing-location";
    expect(() => libraryStateSchema.parse(broken)).toThrow(/references unknown location/);
  });
});

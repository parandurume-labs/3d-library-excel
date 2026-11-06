import { dataMode } from "./auth";
import { LibraryError, type LibraryRepository } from "./domain";
import { ExcelGraphRepository } from "./repositories/excel";
import { localRepository } from "./repositories/local";

export function getRepository(accessToken?: string): LibraryRepository {
  if (dataMode === "demo") return localRepository;
  if (!accessToken) throw new LibraryError("Microsoft authentication is required.", "AUTH_REQUIRED", 401);
  const driveId = process.env.GRAPH_DRIVE_ID;
  const itemId = process.env.GRAPH_WORKBOOK_ITEM_ID;
  if (!driveId || !itemId) {
    throw new LibraryError("Graph mode is configured but GRAPH_DRIVE_ID or GRAPH_WORKBOOK_ITEM_ID is missing.", "SCHEMA_ERROR", 500);
  }
  return new ExcelGraphRepository(accessToken, driveId, itemId);
}

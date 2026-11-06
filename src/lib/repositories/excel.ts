import {
  LibraryError,
  libraryStateSchema,
  type EntityName,
  type LibraryRepository,
  type LibrarySnapshot,
  type LibraryState,
} from "../domain";

const TABLE_NAMES: Record<EntityName, string> = {
  books: "Books",
  shelves: "Shelves",
  locations: "Locations",
  users: "Users",
  loans: "Loans",
  reservations: "Reservations",
  settings: "Settings",
};
const REQUIRED_HEADERS: Record<EntityName, string[]> = {
  books: ["id", "version", "title", "author", "year", "ddc", "kdc", "classIndex", "locationId", "shelfId", "bin", "coverColor", "demo"],
  shelves: ["id", "version", "name", "locationId", "zone", "floor", "capacity"],
  locations: ["id", "version", "name", "floor", "zone"],
  users: ["id", "version", "authId", "displayName", "email", "role"],
  loans: ["id", "version", "bookId", "userId", "status", "requestedAt", "approvedAt", "dueAt", "returnedAt"],
  reservations: ["id", "version", "bookId", "userId", "status", "createdAt"],
  settings: ["id", "version", "key", "value"],
};

type Row = Record<string, unknown>;

function parseCell(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function parseRow(headers: string[], values: unknown[], entity: EntityName): Row {
  const row = Object.fromEntries(headers.map((header, index) => [header, parseCell(values[index])]));
  const numbers = entity === "books"
    ? ["version", "year", "classIndex", "demo"]
    : entity === "shelves"
      ? ["version", "floor", "capacity"]
      : entity === "locations"
        ? ["version", "floor"]
        : ["version"];
  for (const key of numbers) {
    if (key === "demo") row[key] = row[key] === true || row[key] === "TRUE" || row[key] === 1;
    else if (row[key] !== undefined) row[key] = Number(row[key]);
  }
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

export function stateToRow(entity: EntityName, row: Row): unknown[] {
  return REQUIRED_HEADERS[entity].map((header) => row[header] ?? "");
}

export class ExcelGraphRepository implements LibraryRepository {
  readonly mode = "graph" as const;
  private base: string;

  constructor(
    private accessToken: string,
    private driveId: string,
    private itemId: string,
  ) {
    this.base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/workbook`;
  }

  private async request<T>(path: string, init?: RequestInit, expected = true): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (response.status === 401) {
      throw new LibraryError("Microsoft sign-in expired. Sign out and sign in again.", "AUTH_EXPIRED", 401);
    }
    if (!response.ok && expected) {
      let detail = response.statusText;
      try {
        const body = await response.json() as { error?: { message?: string; code?: string } };
        detail = body.error?.message ?? detail;
      } catch {}
      throw new LibraryError(`Microsoft Graph error (${response.status}): ${detail}`, "GRAPH_ERROR", 502);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async openSession(): Promise<string> {
    const session = await this.request<{ id: string }>("/createSession", {
      method: "POST",
      body: JSON.stringify({ persistChanges: true }),
    });
    return session.id;
  }

  private tableRows(entity: EntityName, sessionId?: string) {
    return this.request<{ text: unknown[][]; values: unknown[][] }>(
      `/tables/${TABLE_NAMES[entity]}/range`,
      sessionId ? { headers: { "workbook-session-id": sessionId } } : undefined,
    );
  }

  private async readSnapshot(sessionId?: string): Promise<LibrarySnapshot> {
    const ranges = await Promise.all(
      Object.keys(TABLE_NAMES).map((key) => this.tableRows(key as EntityName, sessionId)),
    );
    const state = {} as LibraryState;
    Object.keys(TABLE_NAMES).forEach((name, index) => {
      const entity = name as EntityName;
      const [headerRow, ...values] = ranges[index].values;
      const headers = headerRow?.map(String) ?? [];
      const missing = REQUIRED_HEADERS[entity].filter((header) => !headers.includes(header));
      if (missing.length) {
        throw new LibraryError(`Table ${TABLE_NAMES[entity]} is missing columns: ${missing.join(", ")}.`, "SCHEMA_ERROR", 422);
      }
      (state[entity] as Row[]) = values
        .filter((row) => row.some((cell) => cell !== "" && cell !== null))
        .map((row) => parseRow(headers, row, entity));
    });
    let parsed;
    try {
      parsed = libraryStateSchema.parse(state);
    } catch (error) {
      throw new LibraryError(`Workbook schema validation failed: ${error instanceof Error ? error.message : "invalid data"}`, "SCHEMA_ERROR", 422);
    }
    const schema = Number(parsed.settings.find((setting) => setting.key === "schemaVersion")?.value ?? 0);
    if (schema !== 1) throw new LibraryError(`Unsupported workbook schema ${schema}; expected 1.`, "SCHEMA_ERROR", 422);
    return { state: parsed, mode: "graph", schemaVersion: schema };
  }

  async getSnapshot(): Promise<LibrarySnapshot> {
    return this.readSnapshot();
  }

  async commit(next: LibraryState, expectedVersions: Record<string, number>): Promise<void> {
    const sessionId = await this.openSession();
    try {
      const current = (await this.readSnapshot(sessionId)).state;
      const currentById = Object.values(current).flat().reduce<Record<string, { version: number }>>((all, item) => {
        all[item.id] = item;
        return all;
      }, {});
      for (const [id, version] of Object.entries(expectedVersions)) {
        if ((currentById[id]?.version ?? 0) !== version) {
          throw new LibraryError(`Record ${id} changed in Excel. Reload and try again.`, "CONFLICT", 409);
        }
      }

      for (const entity of Object.keys(TABLE_NAMES) as EntityName[]) {
        const before = current[entity] as unknown as Row[];
        const after = next[entity] as unknown as Row[];
        const beforeMap = new Map(before.map((row, index) => [String(row.id), { row, index }]));
        const afterMap = new Map(after.map((row) => [String(row.id), row]));
        const changed: { index: number; row: Row }[] = [];
        const deleted: number[] = [];
        const added: Row[] = [];
        for (const [id, old] of beforeMap) {
          const replacement = afterMap.get(id);
          if (!replacement) deleted.push(old.index);
          else if (JSON.stringify(old.row) !== JSON.stringify(replacement)) changed.push({ index: old.index, row: replacement });
        }
        for (const [id, row] of afterMap) if (!beforeMap.has(id)) added.push(row);
        for (const item of changed) {
          await this.request(`/tables/${TABLE_NAMES[entity]}/rows/itemAt(${item.index})/range`, {
            method: "PATCH",
            headers: { "workbook-session-id": sessionId },
            body: JSON.stringify({ values: [stateToRow(entity, item.row)] }),
          });
        }
        for (const index of deleted.sort((a, b) => b - a)) {
          await this.request(`/tables/${TABLE_NAMES[entity]}/rows/itemAt(${index})/delete`, {
            method: "POST",
            headers: { "workbook-session-id": sessionId },
          });
        }
        if (added.length) {
          await this.request(`/tables/${TABLE_NAMES[entity]}/rows/add`, {
            method: "POST",
            headers: { "workbook-session-id": sessionId },
            body: JSON.stringify({ values: added.map((row) => stateToRow(entity, row)) }),
          });
        }
      }
    } finally {
      await this.request("/closeSession", {
        method: "POST",
        headers: { "workbook-session-id": sessionId },
      }, false).catch(() => undefined);
    }
  }
}

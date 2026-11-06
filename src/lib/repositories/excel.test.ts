import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoState } from "../demo-data";
import { LibraryError, type EntityName } from "../domain";
import { workbookTables } from "../workbook";
import { ExcelGraphRepository, stateToRow } from "./excel";

function graphTableResponses() {
  const state = createDemoState(520, new Date("2026-01-01T00:00:00.000Z"));
  return { state, response: async (url: string) => {
    const table = workbookTables.find((definition) => url.includes(`/tables/${definition.tableName}/range`));
    if (!table) return new Response(JSON.stringify({}), { status: 404 });
    const rows = state[table.name] as Record<string, unknown>[];
    return new Response(JSON.stringify({
      values: [
        [...table.columns],
        ...rows.map((row) => stateToRow(table.name as EntityName, row)),
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } };
}

describe("ExcelGraphRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads and validates all workbook tables by stable column contract", async () => {
    const fixture = graphTableResponses();
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => fixture.response(String(input))));
    const repository = new ExcelGraphRepository("token", "drive", "item");
    const snapshot = await repository.getSnapshot();
    expect(snapshot.mode).toBe("graph");
    expect(snapshot.state.books).toHaveLength(520);
    expect(snapshot.state.books[0].id).toBe(fixture.state.books[0].id);
  });

  it("surfaces expired delegated authentication", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const repository = new ExcelGraphRepository("expired-token", "drive", "item");
    await expect(repository.getSnapshot()).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
      status: 401,
    } satisfies Partial<LibraryError>);
  });

  it("rechecks expected versions inside the workbook session", async () => {
    const fixture = graphTableResponses();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/createSession")) return new Response(JSON.stringify({ id: "session-1" }), { status: 200 });
      if (url.endsWith("/closeSession")) return new Response("", { status: 204 });
      expect(init?.headers).toBeDefined();
      return fixture.response(url);
    }));
    const repository = new ExcelGraphRepository("token", "drive", "item");
    const next = structuredClone(fixture.state);
    next.books[100].title = "Changed";
    next.books[100].version++;
    await expect(repository.commit(next, { [next.books[100].id]: 0 })).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    const requests = vi.mocked(fetch).mock.calls;
    expect(requests[0][0]).toContain("/createSession");
    expect(requests.at(-1)?.[0]).toContain("/closeSession");
  });
});

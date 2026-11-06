// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState, DEMO_MEMBER_ID } from "@/lib/demo-data";

vi.mock("next/dynamic", () => ({
  default: () => ({ selectedShelfId, highlightedBookId }: { selectedShelfId: string | null; highlightedBookId: string | null }) => (
    <div data-testid="shelf-scene" data-selected-shelf={selectedShelfId ?? ""} data-highlighted-book={highlightedBookId ?? ""}>3D shelf scene</div>
  ),
}));

import LibraryApp from "./library-app";

describe("LibraryApp", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    const state = createDemoState();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      state,
      mode: "demo",
      schemaVersion: 1,
      actor: { id: DEMO_MEMBER_ID, role: "member" },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  it("renders the responsive catalog and filters by synthetic metadata", async () => {
    render(<LibraryApp />);
    expect(await screen.findByText("Find your next great read.")).toBeVisible();
    expect(screen.getByText("LOCAL DEMO DATA")).toBeVisible();
    expect(screen.getByTestId("shelf-scene")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Search books"), { target: { value: "Hidden Atlas" } });
    await waitFor(() => expect(screen.getByText(/books found/).textContent).not.toContain("520"));
    expect(screen.getAllByText("Hidden Atlas 1").length).toBeGreaterThan(0);
  });

  it("opens a book detail and exposes a loan action", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Search books"), { target: { value: "Hidden Atlas 2" } });
    const title = await screen.findAllByText("Hidden Atlas 2");
    fireEvent.click(title.at(-1)!);
    expect(await screen.findByText("Synthetic demo record — not real bibliographic metadata.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Request loan" })).toBeEnabled();
  });

  it("switches the displayed classification system", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.click(screen.getByRole("button", { name: "KDC" }));
    await waitFor(() => expect(screen.getAllByText(/110\./).length).toBeGreaterThan(0));
  });

  it("shows natural Korean metadata after switching language", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ko" } });
    expect(await screen.findByText("다음에 읽을 책을 찾아보세요.")).toBeVisible();
    expect(screen.getAllByText("사라진 지도의 기록").length).toBeGreaterThan(0);
    expect(screen.getAllByText("김하늘").length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("ko");
  });

  it("sends explicit null values when Korean metadata is cleared", async () => {
    const state = createDemoState();
    const actions: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === "/api/actions") {
        actions.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const actorRole = new Headers(init?.headers).get("x-demo-user") === "admin" ? "admin" : "member";
      return new Response(JSON.stringify({
        state,
        mode: "demo",
        schemaVersion: 1,
        actor: { id: actorRole === "admin" ? "user-demo-admin" : DEMO_MEMBER_ID, role: actorRole },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Demo identity"), { target: { value: "admin" } });
    const adminDesk = await screen.findByRole("button", { name: "Admin desk" });
    await waitFor(() => expect(adminDesk).toBeEnabled());
    fireEvent.click(adminDesk);
    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    fireEvent.change(screen.getByLabelText("한국어 제목"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("한국어 저자"), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save book" }).closest("form")!);

    await waitFor(() => expect(actions).toHaveLength(1));
    expect(actions[0]).toMatchObject({ type: "book.update", book: { titleKo: null, authorKo: null } });
  });

  it("keeps details open and highlights the selected book's shelf location", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Search books"), { target: { value: "Hidden Atlas 1" } });
    const titles = await screen.findAllByText("Hidden Atlas 1");
    fireEvent.click(titles.at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: /Show this book's location/ }));

    expect(screen.getByRole("button", { name: "Close details" })).toBeVisible();
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "shelf-01");
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-highlighted-book", "book-0001");
  });
});

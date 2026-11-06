// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState, DEMO_MEMBER_ID } from "@/lib/demo-data";

type SceneProps = {
  selectedShelfId: string | null;
  highlightedBookId: string | null;
  viewRequest?: number;
  onBookClick?: (bookId: string, pointerType: string) => void;
};

// Stands in for the WebGL scene. The buttons play the part of a click on a book in the scene.
vi.mock("next/dynamic", () => ({
  default: () => ({ selectedShelfId, highlightedBookId, viewRequest, onBookClick }: SceneProps) => (
    <div data-testid="shelf-scene" data-selected-shelf={selectedShelfId ?? ""} data-highlighted-book={highlightedBookId ?? ""} data-view-request={viewRequest ?? ""}>
      3D shelf scene
      {onBookClick && <button onClick={() => onBookClick("book-0016", "mouse")}>Scene: click book-0016</button>}
      {onBookClick && <button onClick={() => onBookClick("book-0016", "touch")}>Scene: tap book-0016</button>}
    </div>
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

  it("shows the administration menu only for administrators and leaves it when the role changes", async () => {
    const state = createDemoState();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
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
    expect(screen.queryByRole("button", { name: "Admin desk" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Demo identity"), { target: { value: "admin" } });
    const adminDesk = await screen.findByRole("button", { name: "Admin desk" });
    fireEvent.click(adminDesk);
    expect(await screen.findByRole("heading", { name: "Admin desk" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Demo identity"), { target: { value: "member" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Admin desk" })).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Find your next great read." })).toBeVisible();
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

  it("locates a book on the 3D library page and keeps its details open", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Search books"), { target: { value: "Hidden Atlas 1" } });
    const titles = await screen.findAllByText("Hidden Atlas 1");
    fireEvent.click(titles.at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: /View on 3D shelf/ }));

    expect(screen.getByRole("heading", { name: "Stand in front of any shelf." })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close details" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Showing location/ })).toBeVisible();
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "shelf-01");
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-highlighted-book", "book-0001");
    // The canvas is invisible to screen readers, so the banner says where the book is.
    const banner = screen.getByRole("status");
    expect(within(banner).getByText("Hidden Atlas 1")).toBeVisible();
    expect(within(banner).getByText("Shelf A1, level 1 from the top, 1 from the left")).toBeVisible();

    // Pressing it again, after looking around, must walk the visitor back to the front of the shelf.
    const before = Number(screen.getByTestId("shelf-scene").dataset.viewRequest);
    fireEvent.click(screen.getByRole("button", { name: /Showing location/ }));
    expect(Number(screen.getByTestId("shelf-scene").dataset.viewRequest)).toBeGreaterThan(before);

    fireEvent.click(within(banner).getByRole("button", { name: "Clear marker" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-highlighted-book", "");
  });

  it("opens the 3D library and moves between the shelves of a row", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.click(screen.getByRole("button", { name: "3D library" }));
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "");

    fireEvent.change(screen.getByLabelText("Choose a shelf"), { target: { value: "shelf-05" } });
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "shelf-05");
    // Shelf 5 ends the first row, so there is nothing to its right.
    expect(screen.getByRole("button", { name: "Shelf to the right" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Shelf to the left" }));
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "shelf-04");
    expect(screen.getByText("Now in front of Shelf D4.")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "");
  });

  it("opens the 3D library from the home scene at the shelf already chosen there", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.click(screen.getByRole("button", { name: "Open 3D library" }));
    expect(screen.getByRole("heading", { name: "Stand in front of any shelf." })).toBeVisible();
    expect(screen.getByRole("button", { name: "Shelf to the left" })).toBeDisabled();
  });

  it("opens details for a book clicked in the scene, and a card first on touch", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.click(screen.getByRole("button", { name: "3D library" }));
    fireEvent.change(screen.getByLabelText("Choose a shelf"), { target: { value: "shelf-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Scene: tap book-0016" }));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("button", { name: "Close details" })).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });
    // Esc first steps back from the shelf to the whole library; the details stay open.
    expect(screen.getByTestId("shelf-scene")).toHaveAttribute("data-selected-shelf", "");
    expect(screen.getByRole("button", { name: "Close details" })).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close details" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choose a shelf"), { target: { value: "shelf-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Scene: click book-0016" }));
    expect(screen.getByRole("button", { name: "Close details" })).toBeVisible();
  });
});

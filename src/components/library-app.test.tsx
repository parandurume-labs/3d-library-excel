// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState, DEMO_MEMBER_ID } from "@/lib/demo-data";

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="shelf-scene">3D shelf scene</div>,
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
});

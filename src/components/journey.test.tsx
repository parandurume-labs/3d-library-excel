// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState, DEMO_ADMIN_ID, DEMO_MEMBER_ID } from "@/lib/demo-data";
import { JOURNEY_STORAGE_KEY, journeySteps, nextAvailableStep } from "@/lib/journey";

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="shelf-scene">3D shelf scene</div>,
}));

import LibraryApp from "./library-app";

describe("journey steps", () => {
  it("shows admin steps only to administrators and the role switch only in the demo", () => {
    const member = journeySteps({ role: "member", mode: "demo" }).map((step) => step.id);
    expect(member).toContain("identity");
    expect(member).not.toContain("admin-queue");

    const admin = journeySteps({ role: "admin", mode: "graph" }).map((step) => step.id);
    expect(admin).toContain("admin-catalog");
    expect(admin).not.toContain("identity");
    expect(admin.at(0)).toBe("welcome");
    expect(admin.at(-1)).toBe("finish");
  });

  it("moves past steps that are no longer available", () => {
    const member = journeySteps({ role: "member", mode: "demo" });
    expect(nextAvailableStep("admin-users", member)).toBe("adapt");
    expect(nextAvailableStep("finish", member)).toBeNull();
  });
});

describe("journey tour", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    const state = createDemoState();
    // Answers as whichever demo identity the app asks for, like the real demo API.
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const admin = (init?.headers as Record<string, string> | undefined)?.["x-demo-user"] === "admin";
      return new Response(JSON.stringify({
        state,
        mode: "demo",
        schemaVersion: 1,
        actor: admin ? { id: DEMO_ADMIN_ID, role: "admin" } : { id: DEMO_MEMBER_ID, role: "member" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
  });

  it("offers the tour on a first visit and remembers when it is dismissed", async () => {
    const { unmount } = render(<LibraryApp />);
    expect(await screen.findByText("New here?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("New here?")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBe("seen");

    unmount();
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    expect(screen.queryByText("New here?")).not.toBeInTheDocument();
  });

  it("walks through the features, switching screens on the way, and closes with Esc", async () => {
    render(<LibraryApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Start the tour" }));

    const tour = screen.getByRole("dialog", { name: "Feature tour" });
    expect(within(tour).getByRole("heading", { name: "Welcome to Durume 3D Library" })).toHaveFocus();
    expect(within(tour).getByText("1 of 12")).toBeVisible();
    expect(within(tour).queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(within(tour).getByRole("heading", { name: "Search by title, author or class number" })).toBeVisible();
    fireEvent.keyDown(tour, { key: "ArrowRight" });
    expect(within(tour).getByRole("heading", { name: "Pick a shelf on the floor plan" })).toBeVisible();

    // The 3D library step opens the 3D library page.
    for (let i = 0; i < 3; i += 1) fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(within(tour).getByRole("heading", { name: "Stand in front of a shelf" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Stand in front of any shelf." })).toBeVisible();

    fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 1, name: "My library" })).toBeVisible();

    fireEvent.click(within(tour).getByRole("button", { name: "Back" }));
    expect(within(tour).getByRole("heading", { name: "Stand in front of a shelf" })).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Feature tour" })).not.toBeInTheDocument();
    // Esc only closed the tour; the 3D page is still showing, and focus lands on its heading
    // because the prompt button that opened the tour is gone.
    const pageHeading = screen.getByRole("heading", { name: "Stand in front of any shelf." });
    expect(pageHeading).toBeVisible();
    await waitFor(() => expect(pageHeading).toHaveFocus());
  });

  it("switches a member to the admin view to continue into the admin desk", async () => {
    render(<LibraryApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Start the tour" }));
    const tour = screen.getByRole("dialog", { name: "Feature tour" });
    while (!within(tour).queryByRole("heading", { name: "Member view and admin view" })) {
      fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    }
    expect(within(tour).getByText("Switch to admin view and the tour goes on to the admin desk.")).toBeVisible();

    fireEvent.click(within(tour).getByRole("button", { name: "Switch to admin view" }));
    await waitFor(() => expect(screen.getByLabelText("Demo identity")).toHaveValue("admin"));
    await waitFor(() => expect(within(tour).queryByRole("button", { name: "Switch to admin view" })).not.toBeInTheDocument());
    expect(within(tour).getByText("10 of 15")).toBeVisible();

    fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(within(tour).getByRole("heading", { name: "Approve loans and check in returns" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Admin desk" })).toBeVisible();
  });

  it("lists every feature in Journey Tour and shows one on screen, in Korean too", async () => {
    render(<LibraryApp />);
    await screen.findByText("LOCAL DEMO DATA");
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ko" } });
    fireEvent.click(screen.getByRole("button", { name: "이용방법" }));
    expect(screen.getByRole("heading", { level: 1, name: "처음 오셨다면 이 순서대로 둘러보세요." })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^화면에서 보기: / })).toHaveLength(13);
    expect(screen.getAllByText("관리자 화면으로 바꾼 뒤 보여 드립니다.")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "화면에서 보기: 장서와 서가 배치" }));
    const tour = await screen.findByRole("dialog", { name: "기능 안내" });
    expect(within(tour).getByRole("heading", { name: "장서와 서가 배치" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 1, name: "사서실" })).toBeVisible();

    fireEvent.click(within(tour).getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

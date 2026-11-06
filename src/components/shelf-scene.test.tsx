// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React, { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/lib/demo-data";

// Stands in for drei's <Text>, which suspends until troika has loaded its font.
// It never resolves, so the test sees the scene exactly as it is while the font loads.
const fontStillLoading = new Promise<never>(() => {});

vi.mock("@react-three/fiber", () => ({
  // The real <Canvas> rethrows a suspension of its children to its own parent.
  // Rendering children in place gives the same result: it reaches the boundary outside.
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Text: () => {
    throw fontStillLoading;
  },
}));

import ShelfScene from "./shelf-scene";

describe("ShelfScene", () => {
  beforeEach(() => {
    // three.js elements (<mesh>, <boxGeometry>, ...) are not DOM elements, so
    // react-dom warns about every one of them when they are rendered in jsdom.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the canvas mounted and the shelves drawn while the label font is loading", () => {
    const { shelves, books } = createDemoState();

    const { container } = render(
      // next/dynamic puts a boundary like this one around the scene in library-app.tsx.
      <Suspense fallback={<div data-testid="outside-fallback" />}>
        <ShelfScene shelves={shelves} books={books} locale="ko" selectedShelfId={null} highlightedBookId={null} onSelect={() => {}} />
      </Suspense>,
    );

    // If the font load suspends past <Canvas>, React swaps the whole canvas for the
    // outside fallback. In the browser that hide-and-reveal is what blanks the scene.
    expect(screen.queryByTestId("outside-fallback")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(container.querySelectorAll("group")).toHaveLength(shelves.length);
  });
});

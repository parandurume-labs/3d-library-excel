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
  // Hooks that need a real canvas. The camera never moves in these tests.
  useFrame: () => {},
  useThree: (select: (state: { camera: object; size: { width: number; height: number } }) => unknown) =>
    select({ camera: {}, size: { width: 800, height: 450 } }),
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
    // jsdom has no WebGL. Pretend it does, so the scene is drawn instead of its fallback.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the fallback instead of the scene when the browser has no WebGL", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const { shelves, books } = createDemoState();

    render(
      <ShelfScene
        shelves={shelves}
        books={books}
        locale="en"
        selectedShelfId={null}
        highlightedBookId={null}
        onSelect={() => {}}
        fallback={<p>No 3D here</p>}
      />,
    );

    expect(screen.getByText("No 3D here")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
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

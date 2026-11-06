// @vitest-environment jsdom
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/lib/demo-data";
import { shelfPosition, standingView } from "@/lib/shelf-layout";

// Drives the camera rig frame by frame without WebGL: useFrame callbacks are collected
// and stepped by hand, and the camera and orbit controls are plain three.js objects.
const rig = vi.hoisted(() => ({
  frames: new Set<(state: unknown, delta: number) => void>(),
  camera: null as unknown as PerspectiveCamera,
  controls: null as unknown as { target: Vector3; update: () => void },
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    const latest = useRef(callback);
    latest.current = callback;
    useEffect(() => {
      const step = (state: unknown, delta: number) => latest.current(state, delta);
      rig.frames.add(step);
      return () => { rig.frames.delete(step); };
    }, []);
  },
  useThree: (select: (state: { camera: PerspectiveCamera; size: { width: number; height: number } }) => unknown) =>
    select({ camera: rig.camera, size: { width: 800, height: 450 } }),
}));

vi.mock("@react-three/drei", () => ({
  Text: () => null,
  OrbitControls: forwardRef(function OrbitControls(_props: object, ref: React.Ref<unknown>) {
    useImperativeHandle(ref, () => rig.controls);
    return null;
  }),
}));

import ShelfScene from "./shelf-scene";

const { shelves, books } = createDemoState();
const frontOf = (index: number) =>
  new Vector3(...standingView(shelfPosition(index, shelves.length), { aspect: 800 / 450, fov: 55 }).position);

function step(frames: number) {
  act(() => {
    for (let frame = 0; frame < frames; frame += 1) {
      for (const callback of [...rig.frames]) callback({ clock: { elapsedTime: frame / 60 } }, 1 / 60);
    }
  });
}

function scene(selectedShelfId: string | null, viewRequest: number) {
  return (
    <ShelfScene
      shelves={shelves}
      books={books}
      locale="en"
      selectedShelfId={selectedShelfId}
      highlightedBookId={null}
      onSelect={() => {}}
      followSelection
      viewRequest={viewRequest}
    />
  );
}

describe("ShelfScene camera", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
    rig.frames.clear();
    rig.camera = new PerspectiveCamera(42, 800 / 450);
    rig.camera.position.set(10, 10.5, 19);
    rig.controls = { target: new Vector3(), update: () => {} };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("walks up to a shelf", () => {
    render(scene("shelf-01", 1));
    step(600);
    expect(rig.camera.position.distanceTo(frontOf(0))).toBeLessThan(0.05);
  });

  it("still reaches the shelf when a trip away from it is cut short", () => {
    const { rerender } = render(scene("shelf-01", 1));
    step(600);
    rerender(scene(null, 2));
    step(10);
    rerender(scene("shelf-01", 3));
    step(600);
    expect(rig.camera.position.distanceTo(frontOf(0))).toBeLessThan(0.05);
  });

  it("returns to the front of the shelf when asked again after the visitor looked around", () => {
    const { rerender } = render(scene("shelf-01", 1));
    step(600);
    rig.camera.position.add(new Vector3(4, 2, 0));
    rerender(scene("shelf-01", 2));
    step(600);
    expect(rig.camera.position.distanceTo(frontOf(0))).toBeLessThan(0.05);
  });
});

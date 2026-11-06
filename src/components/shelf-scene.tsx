"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Color, MathUtils, Vector3, type Group, type Mesh, type MeshStandardMaterial, type PerspectiveCamera } from "three";
import type { Book, Shelf } from "@/lib/domain";
import { getShelfDisplay, type Locale } from "@/lib/i18n";
import {
  BOOK_FACE_Z,
  COLUMN_SPACING,
  FLOOR_Y,
  ROW_SPACING,
  SHELF_DEPTH,
  SHELF_HEIGHT,
  SHELF_WIDTH,
  SHELVES_PER_ROW,
  STANDING_DISTANCE,
  boardY,
  gridFor,
  layoutShelfBooks,
  levelHeight,
  overviewView,
  shelfPosition,
  slotPosition,
  slotWidth,
  standingView,
  type Vec3,
} from "@/lib/shelf-layout";

export type SceneTarget = { kind: "book" | "shelf"; id: string };
export type ScenePointer = { x: number; y: number; type: string };

type Props = {
  shelves: Shelf[];
  books: Book[];
  locale: Locale;
  selectedShelfId: string | null;
  highlightedBookId: string | null;
  onSelect: (shelfId: string, pointerType: string) => void;
  /**
   * Set on the 3D library page. The camera then follows the selection: it stands in
   * front of the selected shelf, or shows the whole library when nothing is selected.
   * Left out (the home preview), the camera stays wherever the visitor put it.
   */
  followSelection?: boolean;
  /**
   * Bumped on every request to move the camera, even to the same place again: after the visitor
   * has looked around, asking for the shelf again must bring them back to its front.
   */
  viewRequest?: number;
  hovered?: SceneTarget | null;
  /** Shelves are reported in the overview, books only on the shelf the visitor stands at. */
  onHover?: (target: SceneTarget | null, pointer: ScenePointer) => void;
  onBookClick?: (bookId: string, pointerType: string) => void;
  /** Books that are on loan: drawn faintly where they belong. */
  absentBookIds?: ReadonlySet<string>;
  /** Shown instead of the scene when the browser cannot draw it. */
  fallback?: ReactNode;
};

const OVERVIEW_POSITION: Vec3 = [10, 10.5, 19];
const OVERVIEW_TARGET: Vec3 = [0, -0.4, 1.2];
const OVERVIEW_FOV = 42;
const STANDING_FOV = 55;
const BACKGROUND = "#f4efe6";
/** A pointer that travels further than this between press and release was dragging the view. */
const DRAG_THRESHOLD = 6;

function prefersReducedMotion() {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

// drei's <Text> suspends until its font has loaded. This boundary keeps that
// inside the scene, so the shelves are drawn right away and only the label waits.
// Without it the suspension leaves <Canvas>: React hides the whole canvas and
// shows it again, and in development (StrictMode) showing it again re-runs the
// Canvas cleanup, which drops the WebGL context and leaves the scene blank.
function ShelfLabel({ children }: { children: string }) {
  return (
    <Suspense fallback={null}>
      <Text position={[0, 1.82, 0]} fontSize={0.18} color="#3f2d25" anchorX="center">
        {children}
      </Text>
    </Suspense>
  );
}

/** Pin above the shelf that holds the located book, so it can be found from across the room. */
function LocatedPin() {
  const pin = useRef<Group>(null);
  const still = useRef(prefersReducedMotion());
  useFrame(({ clock }) => {
    if (pin.current && !still.current) pin.current.position.y = 2.55 + Math.sin(clock.elapsedTime * 3) * 0.12;
  });
  return (
    <group ref={pin} position={[0, 2.55, 0]} scale={1.5}>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.22, 20, 14]} />
        <meshStandardMaterial color="#ffd166" emissive="#c77700" emissiveIntensity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.16, 0.45, 16]} />
        <meshStandardMaterial color="#ffd166" emissive="#c77700" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

const PULSES = 3;
const PULSE_SPEED = 5;

/** The located book: yellow, pulled forward, and pulsing a few times when it first appears. */
function LocatedBook({ bookId, position, size }: { bookId: string; position: Vec3; size: Vec3 }) {
  const mesh = useRef<Mesh>(null);
  const started = useRef<number | null>(null);
  const still = useRef(prefersReducedMotion());
  useFrame(({ clock }) => {
    const material = mesh.current?.material as MeshStandardMaterial | undefined;
    if (!mesh.current || !material || still.current) return;
    started.current ??= clock.elapsedTime;
    const phase = (clock.elapsedTime - started.current) * PULSE_SPEED;
    const wave = phase < PULSES * 2 * Math.PI ? (1 - Math.cos(phase)) / 2 : 0;
    material.emissiveIntensity = 0.55 + wave * 0.8;
    mesh.current.scale.setScalar(1.12 + wave * 0.1);
  });
  return (
    <mesh ref={mesh} userData={{ bookId }} position={position} scale={1.12} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#ffbf2e" emissive="#b86a00" emissiveIntensity={0.55} roughness={0.4} />
    </mesh>
  );
}

/** A figure in the aisle: where a visitor stands to read the selected shelf. */
function Visitor({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.3, 1.3, 4, 12]} />
        <meshStandardMaterial color="#3f5f6b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.27, 16, 12]} />
        <meshStandardMaterial color="#e8c9a8" roughness={0.7} />
      </mesh>
    </group>
  );
}

type Pose = { key: string; position: Vec3; target: Vec3; fov: number; standing: boolean; distance: number };

function CameraRig({ pose }: { pose: Pose | null }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const goal = useMemo(
    () => (pose ? { position: new Vector3(...pose.position), target: new Vector3(...pose.target) } : null),
    [pose],
  );
  const instant = useRef(prefersReducedMotion());

  const moving = Boolean(pose) && settledKey !== pose?.key;

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!pose || !goal || !orbit || settledKey === pose.key) return;
    const step = instant.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 5);
    camera.position.lerp(goal.position, step);
    orbit.target.lerp(goal.target, step);
    const lens = camera as PerspectiveCamera;
    if (lens.isPerspectiveCamera) {
      lens.fov = MathUtils.lerp(lens.fov, pose.fov, step);
      lens.updateProjectionMatrix();
    }
    if (camera.position.distanceTo(goal.position) < 0.03) {
      camera.position.copy(goal.position);
      orbit.target.copy(goal.target);
      if (lens.isPerspectiveCamera) {
        lens.fov = pose.fov;
        lens.updateProjectionMatrix();
      }
      setSettledKey(pose.key);
    }
    orbit.update();
  });

  // While the camera is travelling the limits are off, or OrbitControls would clamp
  // the path. Standing limits keep the visitor inside the aisle once they have arrived.
  const standing = Boolean(pose?.standing) && !moving;
  const reach = (pose?.distance ?? 0) + (standing ? 0.6 : 10);
  return (
    <OrbitControls
      ref={controls}
      enabled={!moving}
      enablePan={false}
      target={OVERVIEW_TARGET}
      minDistance={standing ? 1.2 : moving ? 0 : 8}
      maxDistance={moving ? Infinity : pose ? reach : 32}
      minAzimuthAngle={standing ? -0.75 : -Infinity}
      maxAzimuthAngle={standing ? 0.75 : Infinity}
      minPolarAngle={standing ? 1.0 : 0}
      maxPolarAngle={standing ? 1.8 : moving ? Math.PI : Math.PI / 2 - 0.05}
    />
  );
}

const FADED = new Color(BACKGROUND);

function Shelves({ shelves, books, locale, selectedShelfId, highlightedBookId, onSelect, followSelection, viewRequest = 0, hovered, onHover, onBookClick, absentBookIds }: Props) {
  const size = useThree((state) => state.size);
  const grid = useMemo(() => gridFor(books), [books]);
  const slots = useMemo(() => {
    const byShelf = new Map<string, Book[]>();
    for (const book of books) {
      const list = byShelf.get(book.shelfId);
      if (list) list.push(book);
      else byShelf.set(book.shelfId, [book]);
    }
    return new Map(shelves.map((shelf) => {
      const shelfBooks = byShelf.get(shelf.id) ?? [];
      const placed = layoutShelfBooks(shelfBooks, grid, highlightedBookId);
      return [shelf.id, shelfBooks.flatMap((book) => {
        const slot = placed.get(book.id);
        return slot ? [{ book, ...slotPosition(slot, grid) }] : [];
      })] as const;
    }));
  }, [books, grid, highlightedBookId, shelves]);

  const selectedIndex = shelves.findIndex((shelf) => shelf.id === selectedShelfId);
  const standingIndex = followSelection ? selectedIndex : -1;
  const locatedShelfId = books.find((book) => book.id === highlightedBookId)?.shelfId ?? null;
  const focusSlot = standingIndex >= 0
    ? slots.get(shelves[standingIndex].id)?.find((item) => item.book.id === highlightedBookId)
    : undefined;
  const aspect = size.width / Math.max(size.height, 1);

  const pose = useMemo<Pose | null>(() => {
    if (!followSelection) return null;
    if (standingIndex < 0) {
      const view = overviewView(shelves.length, { aspect, fov: OVERVIEW_FOV });
      return {
        key: `${viewRequest}:overview:${view.position.map((value) => value.toFixed(2)).join(",")}`,
        ...view,
        fov: OVERVIEW_FOV,
        standing: false,
        distance: new Vector3(...view.position).distanceTo(new Vector3(...view.target)),
      };
    }
    const view = standingView(shelfPosition(standingIndex, shelves.length), {
      aspect,
      fov: STANDING_FOV,
      focus: focusSlot ? { x: focusSlot.x, y: focusSlot.y } : undefined,
    });
    return {
      key: `${viewRequest}:shelf:${standingIndex}:${view.position.map((value) => value.toFixed(2)).join(",")}`,
      position: view.position,
      target: view.target,
      fov: STANDING_FOV,
      standing: true,
      distance: view.distance,
    };
  }, [aspect, focusSlot, followSelection, shelves.length, standingIndex, viewRequest]);

  const rows = Math.max(1, Math.ceil(shelves.length / SHELVES_PER_ROW));
  const bookWidth = slotWidth(grid) * 0.74;
  const bookHeight = Math.min(0.5, levelHeight(grid) - 0.16);
  const selectedPosition = selectedIndex >= 0 ? shelfPosition(selectedIndex, shelves.length) : null;
  // Not every browser makes "click" a PointerEvent, so the pointer type is taken from the press.
  const pressedWith = useRef("mouse");

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[7, 10, 8]} intensity={2.5} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[SHELVES_PER_ROW * COLUMN_SPACING + 14, rows * ROW_SPACING + 12]} />
        <meshStandardMaterial color="#e5ddd0" />
      </mesh>
      {shelves.map((shelf, index) => {
        const position = shelfPosition(index, shelves.length);
        const selected = selectedShelfId === shelf.id;
        const standingHere = index === standingIndex;
        const holdsLocated = shelf.id === locatedShelfId;
        const shelfHovered = hovered?.kind === "shelf" && hovered.id === shelf.id;
        const dimOthers = standingHere && holdsLocated;
        const bodyColor = selected ? "#b95638" : holdsLocated ? "#c98a2b" : shelfHovered ? "#8a5440" : "#6f4030";

        const pointerFrom = (event: ThreeEvent<PointerEvent | MouseEvent>): ScenePointer => ({
          x: event.nativeEvent.offsetX,
          y: event.nativeEvent.offsetY,
          type: (event.nativeEvent as PointerEvent).pointerType || "mouse",
        });
        const bookIdOf = (event: ThreeEvent<PointerEvent | MouseEvent>) => (event.object.userData as { bookId?: string }).bookId;

        return (
          <group
            key={shelf.id}
            name={`shelf:${shelf.id}`}
            position={position}
            onPointerDown={(event) => { pressedWith.current = event.nativeEvent.pointerType || "mouse"; }}
            onClick={(event) => {
              event.stopPropagation();
              if (event.delta > DRAG_THRESHOLD) return;
              const bookId = bookIdOf(event);
              if (standingHere && bookId && onBookClick) onBookClick(bookId, pressedWith.current);
              else onSelect(shelf.id, pressedWith.current);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              (event.nativeEvent.target as HTMLElement).style.cursor = "pointer";
              if (!onHover) return;
              const bookId = bookIdOf(event);
              const target: SceneTarget | null = standingHere
                ? (bookId ? { kind: "book", id: bookId } : null)
                : followSelection ? { kind: "shelf", id: shelf.id } : null;
              onHover(target, pointerFrom(event));
            }}
            onPointerOut={(event) => {
              (event.nativeEvent.target as HTMLElement).style.cursor = "";
              onHover?.(null, pointerFrom(event));
            }}
          >
            <mesh castShadow>
              <boxGeometry args={[SHELF_WIDTH, SHELF_HEIGHT, SHELF_DEPTH]} />
              <meshStandardMaterial color={bodyColor} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0, 0.3]}>
              <boxGeometry args={[2.56, 2.72, 0.08]} />
              <meshStandardMaterial color="#d5ae7c" />
            </mesh>
            {Array.from({ length: grid.levels }, (_, level) => (
              <mesh key={level} position={[0, boardY(level, grid) - 0.03, 0.42]} castShadow>
                <boxGeometry args={[2.56, 0.06, SHELF_DEPTH]} />
                <meshStandardMaterial color="#593427" />
              </mesh>
            ))}
            {(slots.get(shelf.id) ?? []).map(({ book, x, y }, bookIndex) => {
              const height = bookHeight - (bookIndex % 3) * 0.04;
              if (book.id === highlightedBookId) {
                return <LocatedBook key={book.id} bookId={book.id} position={[x, y + height / 2, BOOK_FACE_Z + 0.2]} size={[bookWidth, height, 0.3]} />;
              }
              const bookHovered = hovered?.kind === "book" && hovered.id === book.id;
              const absent = absentBookIds?.has(book.id) ?? false;
              const color = dimOthers ? new Color(book.coverColor).lerp(FADED, 0.5) : book.coverColor;
              return (
                <mesh
                  key={book.id}
                  userData={{ bookId: book.id }}
                  position={[x, y + height / 2, bookHovered ? BOOK_FACE_Z + 0.1 : BOOK_FACE_Z]}
                  castShadow={!absent}
                >
                  <boxGeometry args={[bookWidth, height, 0.3]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={bookHovered ? "#5a4630" : "#000000"}
                    emissiveIntensity={bookHovered ? 0.5 : 0}
                    roughness={0.45}
                    transparent={absent}
                    opacity={absent ? 0.3 : 1}
                  />
                </mesh>
              );
            })}
            {holdsLocated && !standingHere && <LocatedPin />}
            <ShelfLabel>{getShelfDisplay(shelf, locale)}</ShelfLabel>
          </group>
        );
      })}
      {selectedPosition && !followSelection && (
        <Visitor position={[selectedPosition[0], FLOOR_Y, selectedPosition[2] + STANDING_DISTANCE - 0.9]} />
      )}
      <CameraRig pose={pose} />
    </>
  );
}

/** Falls back when the WebGL context cannot be created after all (the check below can pass and creation still fail). */
class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function ShelfScene({ fallback = null, ...props }: Props) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(supportsWebGL()), []);
  if (webgl === false) return <>{fallback}</>;
  if (webgl === null) return null;
  return (
    <SceneErrorBoundary fallback={fallback}>
      <Canvas shadows camera={{ position: OVERVIEW_POSITION, fov: OVERVIEW_FOV }} dpr={[1, 1.5]}>
        <color attach="background" args={[BACKGROUND]} />
        <Shelves {...props} />
      </Canvas>
    </SceneErrorBoundary>
  );
}

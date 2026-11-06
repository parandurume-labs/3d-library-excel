"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import type { Book, Shelf } from "@/lib/domain";
import { getShelfDisplay, type Locale } from "@/lib/i18n";

type Props = {
  shelves: Shelf[];
  books: Book[];
  locale: Locale;
  selectedShelfId: string | null;
  highlightedBookId: string | null;
  onSelect: (shelfId: string) => void;
};

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

function Shelves({ shelves, books, locale, selectedShelfId, highlightedBookId, onSelect }: Props) {
  const visible = shelves;
  const grouped = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const shelf of visible) {
      const shelfBooks = books.filter((book) => book.shelfId === shelf.id);
      const shown = shelfBooks.slice(0, 18);
      const highlightedIndex = shelfBooks.findIndex((book) => book.id === highlightedBookId);
      if (highlightedIndex >= 18) shown[shown.length - 1] = shelfBooks[highlightedIndex];
      map.set(shelf.id, shown);
    }
    return map;
  }, [books, highlightedBookId, visible]);

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[7, 10, 8]} intensity={2.5} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, 0]} receiveShadow>
        <planeGeometry args={[30, 16]} />
        <meshStandardMaterial color="#e5ddd0" />
      </mesh>
      {visible.map((shelf, index) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const x = (column - 2) * 3.2;
        const z = row * 3.5 - 1.4;
        const selected = selectedShelfId === shelf.id;
        return (
          <group
            key={shelf.id}
            position={[x, 0, z]}
            onClick={(event) => { event.stopPropagation(); onSelect(shelf.id); }}
          >
            <mesh castShadow>
              <boxGeometry args={[2.8, 3.1, 0.55]} />
              <meshStandardMaterial color={selected ? "#b95638" : "#6f4030"} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0, 0.3]}>
              <boxGeometry args={[2.4, 2.65, 0.08]} />
              <meshStandardMaterial color="#d5ae7c" />
            </mesh>
            {[-0.86, 0, 0.86].map((y) => (
              <mesh key={y} position={[0, y, 0.42]} castShadow>
                <boxGeometry args={[2.55, 0.08, 0.55]} />
                <meshStandardMaterial color="#593427" />
              </mesh>
            ))}
            {(grouped.get(shelf.id) ?? []).map((book, bookIndex) => {
              const level = Math.floor(bookIndex / 6);
              const spot = bookIndex % 6;
              const highlighted = book.id === highlightedBookId;
              return (
                <mesh key={book.id} position={[-0.95 + spot * 0.37, -0.43 + level * 0.86, highlighted ? 0.7 : 0.58]} scale={highlighted ? 1.16 : 1} castShadow>
                  <boxGeometry args={[0.25, 0.62 + (bookIndex % 3) * 0.05, 0.25]} />
                  <meshStandardMaterial color={highlighted ? "#ffd166" : book.coverColor} emissive={highlighted ? "#9c5f00" : "#000000"} emissiveIntensity={highlighted ? 0.7 : 0} roughness={0.45} />
                </mesh>
              );
            })}
            <ShelfLabel>{getShelfDisplay(shelf, locale)}</ShelfLabel>
          </group>
        );
      })}
      <OrbitControls enablePan={false} minDistance={8} maxDistance={22} target={[0, 0.2, 0]} />
    </>
  );
}

export default function ShelfScene(props: Props) {
  return (
    <Canvas shadows camera={{ position: [9, 8, 13], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#f4efe6"]} />
      <Shelves {...props} />
    </Canvas>
  );
}

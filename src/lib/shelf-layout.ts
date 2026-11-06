import type { Book } from "./domain";

// Where things stand in the 3D library. Kept free of three.js so it can be unit tested.
// Units are scene units; a shelf unit is 3.1 tall, so one unit is roughly 0.7 m.

export type Vec3 = [number, number, number];

export const SHELVES_PER_ROW = 5;
export const COLUMN_SPACING = 3.2;
/** Distance between shelf rows. Leaves an aisle a visitor can stand in. */
export const ROW_SPACING = 5;
export const SHELF_WIDTH = 2.8;
export const SHELF_HEIGHT = 3.1;
export const SHELF_DEPTH = 0.55;
export const FLOOR_Y = -1.7;
/** Where the figure in the home preview stands, in front of a shelf (towards +z, the side the books face). */
export const STANDING_DISTANCE = 3.4;

const INNER_WIDTH = 2.5;
const INNER_BOTTOM = -1.33;
const INNER_TOP = 1.33;

export function shelfPosition(index: number, shelfCount: number): Vec3 {
  const rows = Math.max(1, Math.ceil(shelfCount / SHELVES_PER_ROW));
  const column = index % SHELVES_PER_ROW;
  const row = Math.floor(index / SHELVES_PER_ROW);
  return [
    (column - (SHELVES_PER_ROW - 1) / 2) * COLUMN_SPACING,
    0,
    (row - (rows - 1) / 2) * ROW_SPACING,
  ];
}

/** Front face of the books, measured from the shelf centre. */
export const BOOK_FACE_Z = 0.5;
/** What a standing view tries to keep in frame, relative to the shelf centre: the whole unit and its label. */
const FRAME = { left: -1.6, right: 1.6, bottom: -1.45, top: 1.95 };
/** The furthest a visitor can step back from the books before bumping into the next row. */
export const MAX_STANDING_DISTANCE = ROW_SPACING - SHELF_DEPTH / 2 - 0.35 - BOOK_FACE_Z;

export type StandingView = { position: Vec3; target: Vec3; distance: number; fitsWholeShelf: boolean };

/**
 * Where a visitor stands to face the shelf, and what they look at. The distance is the
 * nearest one that fits the whole shelf on screen. On a narrow screen the aisle is too
 * short for that, so the visitor stands as far back as they can and looks at `focus`
 * (the located book's slot) instead of the shelf centre.
 */
export function standingView(
  shelf: Vec3,
  { aspect, fov, focus }: { aspect: number; fov: number; focus?: { x: number; y: number } },
): StandingView {
  const tan = Math.tan((fov * Math.PI) / 360);
  const width = FRAME.right - FRAME.left;
  const height = FRAME.top - FRAME.bottom;
  const needed = Math.max(height / 2 / tan, width / 2 / (tan * Math.max(aspect, 0.1)));
  const distance = Math.min(needed, MAX_STANDING_DISTANCE);
  const fitsWholeShelf = needed <= MAX_STANDING_DISTANCE;

  let x = 0;
  let y = (FRAME.top + FRAME.bottom) / 2;
  if (!fitsWholeShelf) {
    const halfWidth = distance * tan * aspect;
    const halfHeight = distance * tan;
    const clamp = (value: number, low: number, high: number) => (low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high));
    x = clamp(focus?.x ?? 0, FRAME.left + halfWidth, FRAME.right - halfWidth);
    y = clamp(focus?.y ?? y, FRAME.bottom + halfHeight, FRAME.top - halfHeight);
  }
  return {
    position: [shelf[0] + x, shelf[1] + y + 0.3, shelf[2] + BOOK_FACE_Z + distance],
    target: [shelf[0] + x, shelf[1] + y, shelf[2] + BOOK_FACE_Z],
    distance,
    fitsWholeShelf,
  };
}

/** Direction the overview camera looks from: front right, above. */
const OVERVIEW_DIRECTION: Vec3 = [0.45, 0.5, 0.74];

/** A view of the whole library that fills a scene of the given shape without cutting off a row. */
export function overviewView(shelfCount: number, { aspect, fov }: { aspect: number; fov: number }): { position: Vec3; target: Vec3 } {
  const rows = Math.max(1, Math.ceil(shelfCount / SHELVES_PER_ROW));
  const halfWidth = (SHELVES_PER_ROW * COLUMN_SPACING) / 2 + 0.6;
  // Seen from above at an angle the floor plan foreshortens, but the shelves add height.
  const halfHeight = ((rows - 1) * ROW_SPACING) / 2 * 0.75 + 3.8;
  const tan = Math.tan((fov * Math.PI) / 360);
  const distance = Math.min(Math.max(halfHeight / tan, halfWidth / (tan * Math.max(aspect, 0.1)), 12), 40);
  const length = Math.hypot(...OVERVIEW_DIRECTION);
  const target: Vec3 = [0, -0.4, 0.6];
  return {
    position: [
      target[0] + (OVERVIEW_DIRECTION[0] / length) * distance,
      target[1] + (OVERVIEW_DIRECTION[1] / length) * distance,
      target[2] + (OVERVIEW_DIRECTION[2] / length) * distance,
    ],
    target,
  };
}

export type ShelfGrid = { levels: number; columns: number };
export type Slot = { level: number; column: number };

const BIN_PATTERN = /^\s*([A-Za-z])\s*-\s*(\d{1,3})\s*$/;

/** "C-2" is level C (A is the top level) and the second position from the left. */
export function parseBin(bin: string): Slot | null {
  const match = BIN_PATTERN.exec(bin);
  if (!match) return null;
  const level = match[1].toUpperCase().charCodeAt(0) - 65;
  const column = Number.parseInt(match[2], 10) - 1;
  return column >= 0 ? { level, column } : null;
}

const MIN_GRID: ShelfGrid = { levels: 4, columns: 11 };
const MAX_GRID: ShelfGrid = { levels: 6, columns: 16 };

/** One grid for the whole library, large enough for the bins in use, so every shelf looks alike. */
export function gridFor(books: Pick<Book, "bin">[]): ShelfGrid {
  let levels = MIN_GRID.levels;
  let columns = MIN_GRID.columns;
  for (const book of books) {
    const slot = parseBin(book.bin);
    if (!slot) continue;
    levels = Math.max(levels, slot.level + 1);
    columns = Math.max(columns, slot.column + 1);
  }
  return { levels: Math.min(levels, MAX_GRID.levels), columns: Math.min(columns, MAX_GRID.columns) };
}

/**
 * Gives each book on one shelf a slot. A book goes where its bin says. Books whose bin
 * cannot be read, lies outside the grid, or is already taken fill the free slots in order.
 * Books beyond the shelf's slots are left out, except `pinnedBookId`, which always gets one.
 */
export function layoutShelfBooks(
  shelfBooks: Pick<Book, "id" | "bin">[],
  grid: ShelfGrid,
  pinnedBookId: string | null = null,
): Map<string, Slot> {
  const key = (slot: Slot) => slot.level * grid.columns + slot.column;
  const taken = new Map<number, string>();
  const placed = new Map<string, Slot>();
  const waiting: string[] = [];

  // The pinned book claims its bin first, so a duplicate bin never pushes it aside.
  const ordered = [...shelfBooks].sort((a, b) => Number(b.id === pinnedBookId) - Number(a.id === pinnedBookId));
  for (const book of ordered) {
    const slot = parseBin(book.bin);
    const fits = slot && slot.level < grid.levels && slot.column < grid.columns && !taken.has(key(slot));
    if (slot && fits) {
      taken.set(key(slot), book.id);
      placed.set(book.id, slot);
    } else {
      waiting.push(book.id);
    }
  }

  let next = 0;
  const total = grid.levels * grid.columns;
  for (const bookId of waiting) {
    while (next < total && taken.has(next)) next += 1;
    if (next >= total) {
      if (bookId !== pinnedBookId) continue;
      // Shelf is full: the pinned book takes the last slot from whoever holds it.
      const evicted = taken.get(total - 1);
      if (evicted) placed.delete(evicted);
      next = total - 1;
    }
    taken.set(next, bookId);
    placed.set(bookId, { level: Math.floor(next / grid.columns), column: next % grid.columns });
  }
  return placed;
}

export function levelHeight(grid: ShelfGrid) {
  return (INNER_TOP - INNER_BOTTOM) / grid.levels;
}

/** Height of the board a level's books stand on, relative to the shelf centre. Level 0 is the top. */
export function boardY(level: number, grid: ShelfGrid) {
  return INNER_TOP - (level + 1) * levelHeight(grid);
}

export function slotWidth(grid: ShelfGrid) {
  return INNER_WIDTH / grid.columns;
}

/** Centre of a slot's floor, relative to the shelf centre. */
export function slotPosition(slot: Slot, grid: ShelfGrid): { x: number; y: number } {
  return {
    x: -INNER_WIDTH / 2 + (slot.column + 0.5) * slotWidth(grid),
    y: boardY(slot.level, grid),
  };
}

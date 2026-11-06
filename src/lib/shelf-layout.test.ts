import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo-data";
import {
  MAX_STANDING_DISTANCE,
  overviewView,
  ROW_SPACING,
  SHELF_DEPTH,
  gridFor,
  layoutShelfBooks,
  parseBin,
  shelfPosition,
  standingView,
} from "./shelf-layout";

describe("parseBin", () => {
  it("reads the level letter and the position number", () => {
    expect(parseBin("C-2")).toEqual({ level: 2, column: 1 });
    expect(parseBin(" a - 11 ")).toEqual({ level: 0, column: 10 });
  });

  it("rejects bins it cannot place", () => {
    expect(parseBin("")).toBeNull();
    expect(parseBin("C")).toBeNull();
    expect(parseBin("C-0")).toBeNull();
    expect(parseBin("12")).toBeNull();
  });
});

describe("layoutShelfBooks", () => {
  const grid = { levels: 4, columns: 11 };

  it("puts every demo book on its own shelf at the slot its bin names", () => {
    const { books, shelves } = createDemoState();
    const libraryGrid = gridFor(books);
    for (const shelf of shelves) {
      const shelfBooks = books.filter((book) => book.shelfId === shelf.id);
      const placed = layoutShelfBooks(shelfBooks, libraryGrid);
      expect(placed.size).toBe(shelfBooks.length);
      for (const book of shelfBooks) expect(placed.get(book.id)).toEqual(parseBin(book.bin));
    }
  });

  it("moves books with a taken or unreadable bin to free slots", () => {
    const placed = layoutShelfBooks([
      { id: "a", bin: "A-1" },
      { id: "b", bin: "A-1" },
      { id: "c", bin: "shelf top" },
      { id: "d", bin: "Z-40" },
    ], grid);
    const slots = [...placed.values()].map((slot) => `${slot.level}:${slot.column}`);
    expect(placed.get("a")).toEqual({ level: 0, column: 0 });
    expect(placed.size).toBe(4);
    expect(new Set(slots).size).toBe(4);
  });

  it("always places the located book, even on a full shelf or a shared bin", () => {
    const tiny = { levels: 1, columns: 2 };
    const books = [{ id: "a", bin: "A-1" }, { id: "b", bin: "A-2" }, { id: "c", bin: "A-1" }];
    expect(layoutShelfBooks(books, tiny).has("c")).toBe(false);
    const placed = layoutShelfBooks(books, tiny, "c");
    expect(placed.get("c")).toEqual({ level: 0, column: 0 });
    expect(placed.size).toBe(2);
  });
});

describe("shelf placement", () => {
  it("leaves an aisle wide enough to stand in between shelf rows", () => {
    const front = shelfPosition(0, 15);
    const behind = shelfPosition(5, 15);
    expect(behind[2] - front[2]).toBe(ROW_SPACING);
    expect(MAX_STANDING_DISTANCE).toBeGreaterThan(2.5);
  });

  it("fits the whole shelf on a wide screen", () => {
    const shelf = shelfPosition(7, 15);
    const view = standingView(shelf, { aspect: 16 / 9, fov: 55 });
    expect(view.fitsWholeShelf).toBe(true);
    expect(view.target[0]).toBe(shelf[0]);
    const halfHeight = view.distance * Math.tan((55 * Math.PI) / 360);
    expect(halfHeight).toBeGreaterThanOrEqual(1.7 - 1e-9);
  });

  it("stays in the aisle on a narrow screen and looks at the located book instead", () => {
    const shelf = shelfPosition(7, 15);
    const behind = shelfPosition(12, 15);
    const leftSlot = { x: -1.1, y: 0.9 };
    const view = standingView(shelf, { aspect: 0.6, fov: 55, focus: leftSlot });
    expect(view.fitsWholeShelf).toBe(false);
    // The camera must stay in front of the back panel of the next row.
    expect(view.position[2]).toBeLessThan(behind[2] - SHELF_DEPTH / 2);
    expect(view.target[0]).toBeLessThan(shelf[0]);
    // The full height still fits, so only the sideways framing follows the book.
    expect(view.target[1]).toBeCloseTo(shelf[1] + 0.25);
  });

  it("centres the library on the origin", () => {
    const xs = Array.from({ length: 15 }, (_, index) => shelfPosition(index, 15)[0]);
    const zs = Array.from({ length: 15 }, (_, index) => shelfPosition(index, 15)[2]);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
    expect(Math.min(...zs) + Math.max(...zs)).toBeCloseTo(0);
  });
});

describe("overviewView", () => {
  const distance = (view: ReturnType<typeof overviewView>) => Math.hypot(...view.position.map((value, axis) => value - view.target[axis]));

  it("steps back on a narrow screen so the whole width of the library fits", () => {
    const wide = overviewView(15, { aspect: 2, fov: 42 });
    const narrow = overviewView(15, { aspect: 0.6, fov: 42 });
    expect(distance(narrow)).toBeGreaterThan(distance(wide));
    const halfWidthSeen = distance(narrow) * Math.tan((42 * Math.PI) / 360) * 0.6;
    expect(halfWidthSeen).toBeGreaterThanOrEqual(8.6);
  });

  it("looks at the library from above, in front", () => {
    const view = overviewView(15, { aspect: 2, fov: 42 });
    expect(view.position[1]).toBeGreaterThan(view.target[1]);
    expect(view.position[2]).toBeGreaterThan(view.target[2]);
  });
});

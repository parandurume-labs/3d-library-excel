import { z } from "zod";

export const CLASS_LABELS = [
  "General works",
  "Philosophy & psychology",
  "Religion",
  "Social sciences",
  "Language",
  "Natural sciences",
  "Technology",
  "Arts & recreation",
  "Literature",
  "History & geography",
] as const;

const isoDate = z.string().datetime();
const base = { id: z.string().min(1), version: z.number().int().nonnegative() };

export const bookSchema = z.object({
  ...base,
  title: z.string().min(1),
  author: z.string().min(1),
  titleKo: z.string().min(1).nullable().optional(),
  authorKo: z.string().min(1).nullable().optional(),
  year: z.number().int().min(1900).max(2100),
  ddc: z.string().regex(/^\d{3}(?:\.\d+)?$/),
  kdc: z.string().regex(/^\d{3}(?:\.\d+)?$/),
  classIndex: z.number().int().min(0).max(9),
  locationId: z.string(),
  shelfId: z.string(),
  bin: z.string(),
  coverColor: z.string(),
  demo: z.boolean(),
});
export type Book = z.infer<typeof bookSchema>;

export const shelfSchema = z.object({
  ...base,
  name: z.string(),
  locationId: z.string(),
  zone: z.string(),
  floor: z.number().int().positive(),
  capacity: z.number().int().positive(),
});
export type Shelf = z.infer<typeof shelfSchema>;

export const locationSchema = z.object({
  ...base,
  name: z.string(),
  floor: z.number().int().positive(),
  zone: z.string(),
});
export type Location = z.infer<typeof locationSchema>;

export const userSchema = z.object({
  ...base,
  authId: z.string(),
  displayName: z.string(),
  email: z.email(),
  role: z.enum(["member", "admin"]),
});
export type User = z.infer<typeof userSchema>;

export const loanSchema = z.object({
  ...base,
  bookId: z.string(),
  userId: z.string(),
  status: z.enum(["requested", "approved", "overdue", "return_requested", "returned", "rejected"]),
  requestedAt: isoDate,
  approvedAt: isoDate.optional(),
  dueAt: isoDate.optional(),
  returnedAt: isoDate.optional(),
});
export type Loan = z.infer<typeof loanSchema>;

export const reservationSchema = z.object({
  ...base,
  bookId: z.string(),
  userId: z.string(),
  status: z.enum(["waiting", "ready", "fulfilled", "cancelled"]),
  createdAt: isoDate,
});
export type Reservation = z.infer<typeof reservationSchema>;

export const settingSchema = z.object({
  ...base,
  key: z.string(),
  value: z.string(),
});
export type Setting = z.infer<typeof settingSchema>;

export const libraryStateSchema = z.object({
  books: z.array(bookSchema),
  shelves: z.array(shelfSchema),
  locations: z.array(locationSchema),
  users: z.array(userSchema),
  loans: z.array(loanSchema),
  reservations: z.array(reservationSchema),
  settings: z.array(settingSchema),
}).superRefine((state, context) => {
  const entities = [state.books, state.shelves, state.locations, state.users, state.loans, state.reservations, state.settings];
  for (const rows of entities) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (ids.has(row.id)) {
        context.addIssue({ code: "custom", message: `Duplicate stable id ${row.id}`, path: [row.id] });
      }
      ids.add(row.id);
    }
  }
  const shelfIds = new Set(state.shelves.map((shelf) => shelf.id));
  const locationIds = new Set(state.locations.map((location) => location.id));
  const bookIds = new Set(state.books.map((book) => book.id));
  const userIds = new Set(state.users.map((user) => user.id));
  for (const shelf of state.shelves) {
    if (!locationIds.has(shelf.locationId)) context.addIssue({ code: "custom", message: `Shelf ${shelf.id} references unknown location`, path: [shelf.id, "locationId"] });
  }
  for (const book of state.books) {
    if (!shelfIds.has(book.shelfId)) context.addIssue({ code: "custom", message: `Book ${book.id} references unknown shelf`, path: [book.id, "shelfId"] });
    if (!locationIds.has(book.locationId)) context.addIssue({ code: "custom", message: `Book ${book.id} references unknown location`, path: [book.id, "locationId"] });
    const shelf = state.shelves.find((candidate) => candidate.id === book.shelfId);
    if (shelf && shelf.locationId !== book.locationId) context.addIssue({ code: "custom", message: `Book ${book.id} shelf/location mismatch`, path: [book.id, "locationId"] });
  }
  for (const loan of state.loans) {
    if (!bookIds.has(loan.bookId) || !userIds.has(loan.userId)) context.addIssue({ code: "custom", message: `Loan ${loan.id} has an unknown book or user`, path: [loan.id] });
  }
  for (const reservation of state.reservations) {
    if (!bookIds.has(reservation.bookId) || !userIds.has(reservation.userId)) context.addIssue({ code: "custom", message: `Reservation ${reservation.id} has an unknown book or user`, path: [reservation.id] });
  }
});
export type LibraryState = z.infer<typeof libraryStateSchema>;

export type EntityName = keyof LibraryState;
export type LibraryMode = "demo" | "graph";

export interface LibrarySnapshot {
  state: LibraryState;
  mode: LibraryMode;
  schemaVersion: number;
}

export class LibraryError extends Error {
  constructor(
    message: string,
    public code:
      | "AUTH_REQUIRED"
      | "AUTH_EXPIRED"
      | "FORBIDDEN"
      | "INVALID_STATE"
      | "NOT_FOUND"
      | "CONFLICT"
      | "SCHEMA_ERROR"
      | "GRAPH_ERROR",
    public status = 400,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

export interface Actor {
  id: string;
  role: "member" | "admin";
}

export type LibraryAction =
  | { type: "loan.request"; bookId: string }
  | { type: "reservation.request"; bookId: string }
  | { type: "return.request"; loanId: string }
  | { type: "reservation.cancel"; reservationId: string }
  | { type: "loan.approve"; loanId: string; version: number }
  | { type: "loan.reject"; loanId: string; version: number }
  | { type: "return.process"; loanId: string; version: number }
  | { type: "book.create"; book: Omit<Book, "id" | "version"> }
  | { type: "book.update"; bookId: string; version: number; book: Partial<Omit<Book, "id" | "version">> }
  | { type: "book.delete"; bookId: string; version: number }
  | { type: "book.place"; bookId: string; shelfId: string; bin: string; version: number }
  | { type: "user.create"; user: Omit<User, "id" | "version"> }
  | { type: "user.update"; userId: string; version: number; user: Partial<Omit<User, "id" | "version">> }
  | { type: "user.role"; userId: string; role: User["role"]; version: number };

export interface LibraryRepository {
  readonly mode: LibraryMode;
  getSnapshot(): Promise<LibrarySnapshot>;
  commit(next: LibraryState, expectedVersions: Record<string, number>): Promise<void>;
}

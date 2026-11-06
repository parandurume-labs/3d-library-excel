import { randomUUID } from "node:crypto";
import {
  bookSchema,
  LibraryError,
  userSchema,
  type Actor,
  type LibraryAction,
  type LibraryState,
} from "./domain";

const activeLoanStatuses = new Set(["requested", "approved", "overdue", "return_requested"]);
const activeReservationStatuses = new Set(["waiting", "ready"]);

export function isBookAvailable(state: LibraryState, bookId: string): boolean {
  return !state.loans.some((loan) => loan.bookId === bookId && activeLoanStatuses.has(loan.status));
}

export function assertVersion(entity: { id: string; version: number }, version?: number) {
  if (version !== undefined && entity.version !== version) {
    throw new LibraryError(
      `The ${entity.id} record changed in Excel. Reload and try again.`,
      "CONFLICT",
      409,
    );
  }
}

function byId<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new LibraryError(`${label} was not found.`, "NOT_FOUND", 404);
  return item;
}

function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") {
    throw new LibraryError("Administrator role is required.", "FORBIDDEN", 403);
  }
}

function expectedVersionsFor(before: LibraryState, after: LibraryState): Record<string, number> {
  const beforeItems = Object.values(before).flat().reduce<Record<string, { version: number }>>((all, item) => {
    all[item.id] = item;
    return all;
  }, {});
  const afterItems = Object.values(after).flat().reduce<Record<string, { version: number }>>((all, item) => {
    all[item.id] = item;
    return all;
  }, {});
  const versions: Record<string, number> = {};
  for (const [id, item] of Object.entries(afterItems)) {
    if (!beforeItems[id] || beforeItems[id].version !== item.version) versions[id] = item.version - 1;
  }
  for (const id of Object.keys(beforeItems)) {
    if (!afterItems[id]) versions[id] = beforeItems[id].version;
  }
  return versions;
}

function validatePlacement(state: LibraryState, book: { shelfId: string; locationId: string }) {
  const shelf = byId(state.shelves, book.shelfId, "Shelf");
  byId(state.locations, book.locationId, "Location");
  if (shelf.locationId !== book.locationId) {
    throw new LibraryError("The selected shelf does not belong to the selected location.", "INVALID_STATE", 409);
  }
}

export function transition(
  current: LibraryState,
  actor: Actor,
  action: LibraryAction,
  now = new Date(),
): { state: LibraryState; expectedVersions: Record<string, number> } {
  const state = structuredClone(current);
  switch (action.type) {
    case "loan.request": {
      const book = byId(state.books, action.bookId, "Book");
      if (!isBookAvailable(state, action.bookId)) {
        throw new LibraryError("This book is already on loan or pending approval.", "INVALID_STATE", 409);
      }
      if (state.loans.some((loan) => loan.bookId === action.bookId && loan.userId === actor.id && activeLoanStatuses.has(loan.status))) {
        throw new LibraryError("You already have an active request for this book.", "CONFLICT", 409);
      }
      const reservations = state.reservations
        .filter((reservation) => reservation.bookId === book.id && activeReservationStatuses.has(reservation.status))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (reservations.length && reservations[0].userId !== actor.id) {
        throw new LibraryError("This available book is held for the next reservation.", "CONFLICT", 409);
      }
      if (reservations[0]?.status === "waiting" && reservations[0].userId === actor.id) {
        throw new LibraryError("Your reservation is queued; wait for librarian return processing.", "INVALID_STATE", 409);
      }
      state.loans.push({
        id: `loan-${randomUUID()}`,
        version: 1,
        bookId: action.bookId,
        userId: actor.id,
        status: "requested",
        requestedAt: now.toISOString(),
      });
      if (reservations[0]?.status === "ready") {
        reservations[0].status = "fulfilled";
        reservations[0].version++;
      }
      book.version++;
      break;
    }
    case "reservation.request": {
      const book = byId(state.books, action.bookId, "Book");
      if (state.reservations.some((reservation) => reservation.bookId === action.bookId && reservation.userId === actor.id && activeReservationStatuses.has(reservation.status))) {
        throw new LibraryError("You already have an active reservation for this book.", "CONFLICT", 409);
      }
      if (isBookAvailable(state, action.bookId)) {
        throw new LibraryError("The book is available; request a loan instead.", "INVALID_STATE", 409);
      }
      state.reservations.push({
        id: `reservation-${randomUUID()}`,
        version: 1,
        bookId: action.bookId,
        userId: actor.id,
        status: "waiting",
        createdAt: now.toISOString(),
      });
      book.version++;
      break;
    }
    case "return.request": {
      const loan = byId(state.loans, action.loanId, "Loan");
      if (loan.userId !== actor.id) throw new LibraryError("You may only return your own loan.", "FORBIDDEN", 403);
      if (!["approved", "overdue"].includes(loan.status)) throw new LibraryError("This loan cannot be returned yet.", "INVALID_STATE", 409);
      loan.status = "return_requested";
      loan.version++;
      break;
    }
    case "reservation.cancel": {
      const reservation = byId(state.reservations, action.reservationId, "Reservation");
      if (reservation.userId !== actor.id) throw new LibraryError("You may only cancel your own reservation.", "FORBIDDEN", 403);
      if (!activeReservationStatuses.has(reservation.status)) throw new LibraryError("This reservation is no longer active.", "INVALID_STATE", 409);
      reservation.status = "cancelled";
      reservation.version++;
      break;
    }
    case "loan.approve": {
      requireAdmin(actor);
      const loan = byId(state.loans, action.loanId, "Loan");
      assertVersion(loan, action.version);
      if (loan.status !== "requested") throw new LibraryError("Only requested loans can be approved.", "INVALID_STATE", 409);
      if (state.loans.some((other) => other.id !== loan.id && other.bookId === loan.bookId && activeLoanStatuses.has(other.status) && other.status !== "requested")) {
        throw new LibraryError("Another active loan owns this book.", "CONFLICT", 409);
      }
      const days = Number(state.settings.find((item) => item.key === "loanDurationDays")?.value ?? 14);
      loan.status = "approved";
      loan.approvedAt = now.toISOString();
      loan.dueAt = new Date(now.getTime() + days * 86_400_000).toISOString();
      loan.version++;
      const book = byId(state.books, loan.bookId, "Book");
      book.version++;
      const reservation = state.reservations.find(
        (item) => item.bookId === book.id && item.userId === loan.userId && item.status === "ready",
      );
      if (reservation) {
        reservation.status = "fulfilled";
        reservation.version++;
      }
      break;
    }
    case "loan.reject": {
      requireAdmin(actor);
      const loan = byId(state.loans, action.loanId, "Loan");
      assertVersion(loan, action.version);
      if (loan.status !== "requested") throw new LibraryError("Only requested loans can be rejected.", "INVALID_STATE", 409);
      loan.status = "rejected";
      loan.version++;
      break;
    }
    case "return.process": {
      requireAdmin(actor);
      const loan = byId(state.loans, action.loanId, "Loan");
      assertVersion(loan, action.version);
      if (loan.status !== "return_requested") throw new LibraryError("Member return must be requested first.", "INVALID_STATE", 409);
      loan.status = "returned";
      loan.returnedAt = now.toISOString();
      loan.version++;
      const book = byId(state.books, loan.bookId, "Book");
      book.version++;
      const next = state.reservations
        .filter((reservation) => reservation.bookId === loan.bookId && reservation.status === "waiting")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (next) {
        next.status = "ready";
        next.version++;
      }
      break;
    }
    case "book.create": {
      requireAdmin(actor);
      const book = bookSchema.parse({ ...action.book, id: `book-${randomUUID()}`, version: 1, demo: false });
      validatePlacement(state, book);
      state.books.push(book);
      break;
    }
    case "book.update": {
      requireAdmin(actor);
      const book = byId(state.books, action.bookId, "Book");
      assertVersion(book, action.version);
      const updated = bookSchema.parse({ ...book, ...action.book, id: book.id, version: book.version + 1 });
      validatePlacement(state, updated);
      Object.assign(book, updated);
      break;
    }
    case "book.delete": {
      requireAdmin(actor);
      const book = byId(state.books, action.bookId, "Book");
      assertVersion(book, action.version);
      if (state.loans.some((loan) => loan.bookId === book.id && activeLoanStatuses.has(loan.status))) {
        throw new LibraryError("A book with an active loan cannot be deleted.", "INVALID_STATE", 409);
      }
      state.books = state.books.filter((item) => item.id !== book.id);
      break;
    }
    case "book.place": {
      requireAdmin(actor);
      const book = byId(state.books, action.bookId, "Book");
      const shelf = byId(state.shelves, action.shelfId, "Shelf");
      assertVersion(book, action.version);
      book.shelfId = shelf.id;
      book.locationId = shelf.locationId;
      book.bin = action.bin;
      book.version++;
      break;
    }
    case "user.role": {
      requireAdmin(actor);
      const user = byId(state.users, action.userId, "User");
      assertVersion(user, action.version);
      user.role = action.role;
      user.version++;
      break;
    }
    case "user.create": {
      requireAdmin(actor);
      const user = userSchema.parse({ ...action.user, id: `user-${randomUUID()}`, version: 1 });
      if (state.users.some((existing) => existing.authId === user.authId || existing.email.toLowerCase() === user.email.toLowerCase())) {
        throw new LibraryError("A user with that identity or email already exists.", "CONFLICT", 409);
      }
      state.users.push(user);
      break;
    }
    case "user.update": {
      requireAdmin(actor);
      const user = byId(state.users, action.userId, "User");
      assertVersion(user, action.version);
      const updated = userSchema.parse({ ...user, ...action.user, id: user.id, version: user.version + 1 });
      if (state.users.some((existing) => existing.id !== user.id && (existing.authId === updated.authId || existing.email.toLowerCase() === updated.email.toLowerCase()))) {
        throw new LibraryError("A user with that identity or email already exists.", "CONFLICT", 409);
      }
      Object.assign(user, updated);
      break;
    }
  }
  return { state, expectedVersions: expectedVersionsFor(current, state) };
}

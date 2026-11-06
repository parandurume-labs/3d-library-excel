import { beforeEach, describe, expect, it } from "vitest";
import { createDemoState, DEMO_ADMIN_ID, DEMO_MEMBER_ID } from "./demo-data";
import { LibraryError, type Actor, type LibraryState } from "./domain";
import { localRepository } from "./repositories/local";
import { isBookAvailable, transition } from "./transitions";

const member: Actor = { id: DEMO_MEMBER_ID, role: "member" };
const admin: Actor = { id: DEMO_ADMIN_ID, role: "admin" };

describe("library state transitions", () => {
  it("uses stable IDs and rejects duplicate active loans", () => {
    const state = createDemoState(520);
    const book = state.books[100];
    const first = transition(state, member, { type: "loan.request", bookId: book.id });
    expect(first.state.loans.at(-1)?.bookId).toBe(book.id);
    expect(first.state.loans.at(-1)?.id).toMatch(/^loan-/);
    expect(() => transition(first.state, member, { type: "loan.request", bookId: book.id })).toThrowError(LibraryError);
  });

  it("prevents non-admin circulation decisions", () => {
    const state = createDemoState();
    const request = state.loans.find((loan) => loan.status === "requested")!;
    expect(() => transition(state, member, { type: "loan.approve", loanId: request.id, version: request.version })).toThrowError(/Administrator role/);
  });

  it("approves a request with an explicit due date", () => {
    const state = createDemoState();
    const request = state.loans.find((loan) => loan.status === "requested")!;
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = transition(state, admin, { type: "loan.approve", loanId: request.id, version: request.version }, now);
    const approved = result.state.loans.find((loan) => loan.id === request.id)!;
    expect(approved.status).toBe("approved");
    expect(approved.dueAt).toBe("2026-01-24T00:00:00.000Z");
    expect(result.expectedVersions[request.id]).toBe(request.version);
  });

  it("enforces own-loan return requests and processing order", () => {
    const state = createDemoState();
    const someoneElse = state.loans.find((loan) => loan.userId === "user-demo-member-2" && loan.status === "approved")!;
    expect(() => transition(state, member, { type: "return.request", loanId: someoneElse.id })).toThrowError(/your own/);
    const own = state.loans.find((loan) => loan.userId === DEMO_MEMBER_ID && loan.status === "approved")!;
    const requested = transition(state, member, { type: "return.request", loanId: own.id }).state;
    const updated = requested.loans.find((loan) => loan.id === own.id)!;
    const processed = transition(requested, admin, { type: "return.process", loanId: own.id, version: updated.version }).state;
    expect(processed.loans.find((loan) => loan.id === own.id)?.status).toBe("returned");
  });

  it("allows reservation only for unavailable books and blocks duplicates", () => {
    const state = createDemoState();
    const busyBook = state.loans.find((loan) => loan.status === "approved" && !state.reservations.some((reservation) => reservation.bookId === loan.bookId && reservation.userId === member.id && reservation.status !== "cancelled"))!;
    const freeBook = state.books.find((book) => isBookAvailable(state, book.id))!;
    expect(() => transition(state, member, { type: "reservation.request", bookId: freeBook.id })).toThrowError(/available/);
    const result = transition(state, member, { type: "reservation.request", bookId: busyBook.bookId });
    expect(() => transition(result.state, member, { type: "reservation.request", bookId: busyBook.bookId })).toThrowError(/already/);
  });

  it("protects book delete and detects optimistic conflicts", () => {
    const state = createDemoState();
    const active = state.loans.find((loan) => loan.status === "approved")!;
    const book = state.books.find((item) => item.id === active.bookId)!;
    expect(() => transition(state, admin, { type: "book.delete", bookId: book.id, version: book.version })).toThrowError(/active loan/);
    const oldVersion = book.version;
    state.books.find((item) => item.id === book.id)!.version++;
    expect(() => transition(state, admin, { type: "book.update", bookId: book.id, version: oldVersion, book: { title: "Changed" } })).toThrowError(/changed/);
  });

  it("preserves reservation priority when a returned book becomes available", () => {
    const state = createDemoState();
    const readyReservation = state.reservations.find((item) => item.status === "ready")!;
    readyReservation.userId = "user-demo-member-2";
    const loan = state.loans.find((item) => item.bookId === readyReservation.bookId)!;
    loan.status = "returned";
    expect(() => transition(state, member, { type: "loan.request", bookId: loan.bookId })).toThrowError(/held for the next reservation/);
  });
});

describe("RBAC and local repository", () => {
  beforeEach(() => localRepository.reset());

  it("rejects member admin calls before mutation", () => {
    const state = createDemoState();
    expect(() => transition(state, member, {
      type: "user.role",
      userId: DEMO_ADMIN_ID,
      role: "member",
      version: 1,
    })).toThrowError(/Administrator role/);
  });

  it("surfaces repository version conflicts instead of overwriting", async () => {
    const snapshot = await localRepository.getSnapshot();
    const action = { type: "book.update" as const, bookId: snapshot.state.books[100].id, version: 1, book: { title: "Changed" } };
    const result = transition(snapshot.state, admin, action);
    await localRepository.commit(result.state, result.expectedVersions);
    const stale: LibraryState = snapshot.state;
    await expect(localRepository.commit(stale, { [action.bookId]: 1 })).rejects.toThrow(/changed/);
  });
});

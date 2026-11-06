"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Layers3,
  Library,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor, Book, LibraryAction, LibrarySnapshot, Loan, Reservation, Shelf, User } from "@/lib/domain";
import { CLASS_LABELS } from "@/lib/domain";

const ShelfScene = dynamic(() => import("./shelf-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Building the shelves...</div>,
});

type LoadedSnapshot = LibrarySnapshot & { actor: Actor };
type Tab = "explore" | "my-library" | "admin";
type StatusTone = "available" | "borrowed" | "requested";

function statusFor(book: Book, snapshot: LoadedSnapshot): { label: string; tone: StatusTone } {
  const loan = snapshot.state.loans.find((item) => item.bookId === book.id && ["requested", "approved", "overdue", "return_requested"].includes(item.status));
  if (!loan) return { label: "Available", tone: "available" };
  if (loan.status === "requested") return { label: "Approval pending", tone: "requested" };
  const overdue = loan.status === "overdue" || Boolean(loan.dueAt && new Date(loan.dueAt).getTime() < Date.now());
  return { label: overdue ? "Overdue" : "On loan", tone: "borrowed" };
}

function isOverdue(loan: Loan) {
  return loan.status === "overdue" || Boolean(
    loan.dueAt && ["approved", "return_requested"].includes(loan.status) && new Date(loan.dueAt).getTime() < Date.now(),
  );
}

function dueLabel(loan: Loan) {
  if (!loan.dueAt) return "Awaiting approval";
  const days = Math.ceil((new Date(loan.dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function LibraryApp() {
  const [snapshot, setSnapshot] = useState<LoadedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("explore");
  const [demoIdentity, setDemoIdentity] = useState<"member" | "admin">("member");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [classSystem, setClassSystem] = useState<"ddc" | "kdc">("ddc");
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/library", {
        cache: "no-store",
        headers: { "x-demo-user": demoIdentity },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Library unavailable");
      setSnapshot(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Library unavailable");
    } finally {
      setLoading(false);
    }
  }, [demoIdentity]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (action: LibraryAction, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-demo-user": demoIdentity },
        body: JSON.stringify(action),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Update failed");
      setNotice(success ?? "Saved successfully.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }, [demoIdentity, load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredBooks = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLowerCase();
    return snapshot.state.books.filter((book) => {
      const shelfMatch = !selectedShelfId || book.shelfId === selectedShelfId;
      const classMatch = classFilter === null || book.classIndex === classFilter;
      const textMatch = !needle || `${book.title} ${book.author} ${book.ddc} ${book.kdc}`.toLowerCase().includes(needle);
      return shelfMatch && classMatch && textMatch;
    });
  }, [classFilter, query, selectedShelfId, snapshot]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  useEffect(() => { setPage(0); }, [query, classFilter, selectedShelfId]);
  const visibleBooks = filteredBooks.slice(page * pageSize, page * pageSize + pageSize);
  const selectedBook = snapshot?.state.books.find((book) => book.id === selectedBookId) ?? null;
  const ownLoans = snapshot?.state.loans.filter((loan) => loan.userId === snapshot.actor.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)) ?? [];
  const ownReservations = snapshot?.state.reservations.filter((reservation) => reservation.userId === snapshot.actor.id) ?? [];
  const actorUser = snapshot?.state.users.find((user) => user.id === snapshot.actor.id);
  const available = snapshot ? snapshot.state.books.filter((book) => statusFor(book, snapshot).tone === "available").length : 0;
  const selectedShelf = snapshot?.state.shelves.find((shelf) => shelf.id === selectedShelfId);

  if (loading && !snapshot) {
    return <main className="loading-screen"><Library size={42} /><h1>Opening Durume Library</h1><p>Loading your Excel-backed collection...</p><div className="loading-line" /></main>;
  }

  if (!snapshot) {
    return (
      <main className="loading-screen error-state">
        <AlertTriangle size={42} />
        <h1>We could not open the library</h1>
        <p>{error}</p>
        <div className="drawer-actions">
          <Link className="primary-button" href="/api/auth/signin">Sign in with Microsoft</Link>
          <button className="secondary-button" onClick={load}>Try again</button>
        </div>
      </main>
    );
  }

  const modeLabel = snapshot.mode === "demo" ? "LOCAL DEMO DATA" : "ONEDRIVE EXCEL";

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setNavOpen(true)}><Menu /></button>
        <div className="wordmark"><span className="logo-mark"><BookOpen /></span><div><strong>DURUME</strong><span>3D LIBRARY</span></div></div>
        <label className="global-search">
          <Search size={18} />
          <input aria-label="Search books" placeholder="Search title, author, DDC or KDC..." value={query} onChange={(event) => { setQuery(event.target.value); setTab("explore"); }} />
          <kbd>/</kbd>
        </label>
        <div className="top-actions">
          <span className={`mode-badge ${snapshot.mode}`}><span />{modeLabel}</span>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setTab("my-library")}>
            <Bell /><b>{ownReservations.filter((item) => item.status === "ready").length + ownLoans.filter((item) => item.status === "requested" || isOverdue(item)).length}</b>
          </button>
          {snapshot.mode === "demo" ? (
            <select className="identity-select" aria-label="Demo identity" value={demoIdentity} onChange={(event) => setDemoIdentity(event.target.value as "member" | "admin")}>
              <option value="member">Member view</option>
              <option value="admin">Admin view</option>
            </select>
          ) : (
            <Link className="avatar" href="/api/auth/signout" title="Sign out">{initials(actorUser?.displayName ?? "U")}</Link>
          )}
        </div>
      </header>

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="sidebar-mobile-head"><strong>Menu</strong><button className="icon-button" onClick={() => setNavOpen(false)}><X /></button></div>
        <nav>
          <p>LIBRARY</p>
          <button className={tab === "explore" ? "active" : ""} onClick={() => { setTab("explore"); setNavOpen(false); }}><Library />Explore shelves</button>
          <button className={tab === "my-library" ? "active" : ""} onClick={() => { setTab("my-library"); setNavOpen(false); }}><BookOpen />My library <small>{ownLoans.filter((loan) => loan.status !== "returned" && loan.status !== "rejected").length}</small></button>
          <p>MANAGE</p>
          <button className={tab === "admin" ? "active" : ""} disabled={snapshot.actor.role !== "admin"} onClick={() => { setTab("admin"); setNavOpen(false); }}><ShieldCheck />Admin desk</button>
          <p>COLLECTION</p>
          <button onClick={() => { setTab("explore"); setQuery(""); setSelectedShelfId(null); setClassFilter(null); setNavOpen(false); }}><Layers3 />All books <small>{snapshot.state.books.length}</small></button>
          <button onClick={() => { setTab("explore"); setClassFilter(9); setNavOpen(false); }}><Clock3 />Recently added</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><span className="avatar">{initials(actorUser?.displayName ?? "Demo")}</span><div><strong>{actorUser?.displayName}</strong><span>{actorUser?.role === "admin" ? "Librarian" : "Member"} account</span></div></div>
          <button><CircleHelp />Help & guides</button>
        </div>
      </aside>
      {navOpen && <button aria-label="Close menu" className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <main className="main-content">
        {error && <div className="alert error"><AlertTriangle /> <span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
        {notice && <div className="alert success"><Check />{notice}</div>}

        {tab === "explore" && (
          <>
            <div className="page-heading">
              <div><span className="eyebrow">YOUR COLLECTION, IN SPACE</span><h1>Find your next great read.</h1><p>Explore every shelf, check availability, and send a request in seconds.</p></div>
              <div className="heading-stats"><span><strong>{snapshot.state.books.length}</strong> BOOKS</span><i /><span><strong>{available}</strong> AVAILABLE</span><i /><span><strong>{snapshot.state.shelves.length}</strong> SHELVES</span></div>
            </div>

            <section className="scene-card">
              <div className="scene-toolbar">
                <div><span className="live-dot" /><strong>INTERACTIVE FLOOR PLAN</strong></div>
                <div className="scene-location"><MapPin />{selectedShelf ? `${selectedShelf.name} · Floor ${selectedShelf.floor}` : "All locations"}<SlidersHorizontal /></div>
              </div>
              <div className="scene-wrap">
                <ShelfScene shelves={snapshot.state.shelves} books={snapshot.state.books} selectedShelfId={selectedShelfId} onSelect={(id) => setSelectedShelfId(selectedShelfId === id ? null : id)} />
                <div className="scene-hint"><span>↔</span> Drag to rotate <b>·</b> Scroll to zoom <b>·</b> Click a shelf</div>
              </div>
              <div className="scene-legend">
                <span className="legend-title">LOCATIONS</span>
                {snapshot.state.locations.map((location) => <button key={location.id} onClick={() => { setSelectedShelfId(snapshot.state.shelves.find((shelf) => shelf.locationId === location.id)?.id ?? null); }}><i style={{ background: ["#b95638", "#65827b", "#9c8055"][snapshot.state.locations.indexOf(location)] }} />{location.name}</button>)}
                {selectedShelfId && <button className="clear-filter" onClick={() => setSelectedShelfId(null)}>Clear shelf filter</button>}
              </div>
            </section>

            <div className="content-heading"><div><span className="eyebrow">CATALOG</span><h2>{selectedShelf ? `${selectedShelf.name} collection` : "Browse the collection"}</h2></div><p>{filteredBooks.length} books found</p></div>
            <div className="class-system-selector" role="group" aria-label="Classification system">
              <span>Classification</span>
              <button className={classSystem === "ddc" ? "active" : ""} onClick={() => setClassSystem("ddc")}>DDC</button>
              <button className={classSystem === "kdc" ? "active" : ""} onClick={() => setClassSystem("kdc")}>KDC</button>
            </div>
            <div className="class-filters">
              <button className={classFilter === null ? "active" : ""} onClick={() => setClassFilter(null)}>All classes</button>
              {CLASS_LABELS.map((label, index) => <button key={label} className={classFilter === index ? "active" : ""} onClick={() => setClassFilter(index)}>{index}00 <span>{label.split(" ")[0]}</span></button>)}
            </div>

            <div className="book-grid">
              {visibleBooks.map((book) => {
                const status = statusFor(book, snapshot);
                const shelf = snapshot.state.shelves.find((item) => item.id === book.shelfId);
                return (
                  <button className="book-card" key={book.id} onClick={() => setSelectedBookId(book.id)}>
                    <div className="book-cover" style={{ background: book.coverColor }}>
                      <span className="book-class">{classSystem === "ddc" ? book.ddc : book.kdc}</span>
                      <BookOpen size={28} />
                      <strong>{book.title}</strong>
                      <small>{book.author}</small>
                    </div>
                    <div className="book-meta">
                      <span className={`availability ${status.tone}`}><i />{status.label}</span>
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      <span className="location-line"><MapPin />{shelf?.name} · {book.bin}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {visibleBooks.length === 0 && <div className="empty-state"><Search /><h3>No matching books</h3><p>Try another search, class, or shelf.</p></div>}
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft />Previous</button>
              <span>Page <strong>{page + 1}</strong> of {pageCount}</span>
              <button disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight /></button>
            </div>
          </>
        )}

        {tab === "my-library" && (
          <MemberDashboard snapshot={snapshot} ownLoans={ownLoans} ownReservations={ownReservations} busy={busy} act={act} />
        )}

        {tab === "admin" && snapshot.actor.role === "admin" && (
          <AdminDashboard
            snapshot={snapshot}
            busy={busy}
            act={act}
            onNewBook={() => { setEditingBook(null); setShowBookForm(true); }}
            onEditBook={(book) => { setEditingBook(book); setShowBookForm(true); }}
            onNewUser={() => setShowUserForm(true)}
          />
        )}
      </main>

      {selectedBook && (
        <div className="drawer-backdrop" onClick={() => setSelectedBookId(null)}>
          <aside className="book-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close icon-button" aria-label="Close details" onClick={() => setSelectedBookId(null)}><X /></button>
            <div className="drawer-cover" style={{ background: selectedBook.coverColor }}><BookOpen /><span>{selectedBook.ddc}</span><strong>{selectedBook.title}</strong></div>
            <span className="eyebrow">{classSystem.toUpperCase()} · {CLASS_LABELS[selectedBook.classIndex]}</span>
            <h2>{selectedBook.title}</h2>
            <p className="drawer-author">{selectedBook.author} · {selectedBook.year}</p>
            <div className="code-pills"><span>DDC {selectedBook.ddc}</span><span>KDC {selectedBook.kdc}</span></div>
            <div className="detail-location"><MapPin /><div><strong>{snapshot.state.shelves.find((shelf) => shelf.id === selectedBook.shelfId)?.name}</strong><span>{snapshot.state.locations.find((location) => location.id === selectedBook.locationId)?.name} · Floor {snapshot.state.locations.find((location) => location.id === selectedBook.locationId)?.floor} · Bin {selectedBook.bin}</span></div></div>
            <span className={`availability large ${statusFor(selectedBook, snapshot).tone}`}><i />{statusFor(selectedBook, snapshot).label}</span>
            <p className="demo-note">{selectedBook.demo ? "Synthetic demo record — not real bibliographic metadata." : "Library catalog record."}</p>
            <div className="drawer-actions">
              {statusFor(selectedBook, snapshot).tone === "available" ? (
                <button className="primary-button" disabled={busy} onClick={() => act({ type: "loan.request", bookId: selectedBook.id }, "Loan request sent to the librarian.")}>Request loan</button>
              ) : (
                <button className="primary-button" disabled={busy || ownReservations.some((item) => item.bookId === selectedBook.id && ["waiting", "ready"].includes(item.status))} onClick={() => act({ type: "reservation.request", bookId: selectedBook.id }, "Reservation added to the queue.")}>Reserve next</button>
              )}
              {snapshot.actor.role === "admin" && <button className="secondary-button" onClick={() => { setEditingBook(selectedBook); setShowBookForm(true); setSelectedBookId(null); }}><Settings />Edit</button>}
            </div>
          </aside>
        </div>
      )}

      {showBookForm && snapshot.actor.role === "admin" && (
        <BookForm book={editingBook} shelves={snapshot.state.shelves} onClose={() => setShowBookForm(false)} onSave={(book) => {
          if (editingBook) void act({ type: "book.update", bookId: editingBook.id, version: editingBook.version, book }, "Book details and placement updated.");
          else void act({ type: "book.create", book: book as Omit<Book, "id" | "version"> }, "New book added.");
          setShowBookForm(false);
        }} />
      )}
      {showUserForm && <UserForm onClose={() => setShowUserForm(false)} onSave={(user) => { void act({ type: "user.create", user }, "User added."); setShowUserForm(false); }} />}
    </div>
  );
}

function MemberDashboard({ snapshot, ownLoans, ownReservations, busy, act }: {
  snapshot: LoadedSnapshot;
  ownLoans: Loan[];
  ownReservations: Reservation[];
  busy: boolean;
  act: (action: LibraryAction, success?: string) => Promise<void>;
}) {
  const active = ownLoans.filter((loan) => !["returned", "rejected"].includes(loan.status));
  const notices = [
    ...ownLoans.filter(isOverdue).map((loan) => ({ key: loan.id, title: "A book is overdue", text: `${snapshot.state.books.find((book) => book.id === loan.bookId)?.title} must be returned.`, tone: "danger" })),
    ...ownReservations.filter((reservation) => reservation.status === "ready").map((reservation) => ({ key: reservation.id, title: "Reservation ready", text: `${snapshot.state.books.find((book) => book.id === reservation.bookId)?.title} is ready for pickup.`, tone: "ready" })),
    ...ownLoans.filter((loan) => loan.status === "approved").map((loan) => ({ key: loan.id, title: "Loan approved", text: `${snapshot.state.books.find((book) => book.id === loan.bookId)?.title} is now on loan.`, tone: "ready" })),
  ];
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">PERSONAL DESK</span><h1>My library</h1><p>Track loans, due dates, return requests, and reservations.</p></div></div>
      <div className="member-stats">
        <div><BookOpen /><span><strong>{active.length}</strong>Active loans</span></div>
        <div><CalendarDays /><span><strong>{active.filter(isOverdue).length}</strong>Overdue</span></div>
        <div><Clock3 /><span><strong>{ownReservations.filter((item) => ["waiting", "ready"].includes(item.status)).length}</strong>Reservations</span></div>
      </div>
      <section className="panel notice-panel"><div className="panel-heading"><h2><Bell />Notifications</h2><span>{notices.length} in app</span></div>
        {notices.length ? notices.map((notice) => <div className={`notice-row ${notice.tone}`} key={notice.key}><span><Bell /></span><div><strong>{notice.title}</strong><p>{notice.text}</p></div></div>) : <div className="compact-empty"><Check />You are all caught up.</div>}
      </section>
      <section className="panel"><div className="panel-heading"><h2><BookOpen />My loans</h2><span>{active.length} active</span></div>
        <div className="responsive-table">
          <table><thead><tr><th>Book</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>
            {ownLoans.map((loan) => {
              const book = snapshot.state.books.find((item) => item.id === loan.bookId);
              return <tr key={loan.id}><td><strong>{book?.title ?? loan.bookId}</strong><small>{book?.author}</small></td><td><span className={`status-chip ${loan.status}`}>{loan.status.replace("_", " ")}</span></td><td>{dueLabel(loan)}</td><td>{["approved", "overdue"].includes(loan.status) ? <button className="small-button" disabled={busy} onClick={() => act({ type: "return.request", loanId: loan.id }, "Return request sent.")}>Request return</button> : <span>—</span>}</td></tr>;
            })}
          </tbody></table>
        </div>
        {!ownLoans.length && <div className="compact-empty">No loans yet. Explore a shelf to begin.</div>}
      </section>
      <section className="panel"><div className="panel-heading"><h2><Clock3 />My reservations</h2><span>Queue order is preserved</span></div>
        {ownReservations.map((reservation) => <div className="reservation-row" key={reservation.id}><div><strong>{snapshot.state.books.find((book) => book.id === reservation.bookId)?.title}</strong><span>{reservation.status} · {new Date(reservation.createdAt).toLocaleDateString()}</span></div>{["waiting", "ready"].includes(reservation.status) && <button className="text-button" disabled={busy} onClick={() => act({ type: "reservation.cancel", reservationId: reservation.id }, "Reservation cancelled.")}>Cancel</button>}</div>)}
        {!ownReservations.length && <div className="compact-empty">No reservations.</div>}
      </section>
    </>
  );
}

function AdminDashboard({ snapshot, busy, act, onNewBook, onEditBook, onNewUser }: {
  snapshot: LoadedSnapshot;
  busy: boolean;
  act: (action: LibraryAction, success?: string) => Promise<void>;
  onNewBook: () => void;
  onEditBook: (book: Book) => void;
  onNewUser: () => void;
}) {
  const queue = snapshot.state.loans.filter((loan) => ["requested", "return_requested"].includes(loan.status));
  const overdue = snapshot.state.loans.filter((loan) => loan.status === "overdue" || (loan.dueAt && new Date(loan.dueAt).getTime() < Date.now() && loan.status === "approved"));
  const activeReservations = snapshot.state.reservations.filter((item) => ["waiting", "ready"].includes(item.status));
  const bookFor = (id: string) => snapshot.state.books.find((book) => book.id === id);
  const userFor = (id: string) => snapshot.state.users.find((user) => user.id === id);
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">LIBRARIAN WORKSPACE</span><h1>Admin desk</h1><p>Approve circulation requests and keep the Excel-backed catalog organized.</p></div><button className="primary-button" onClick={onNewBook}><Plus />New book</button></div>
      <div className="member-stats">
        <div><Clock3 /><span><strong>{queue.length}</strong>Needs action</span></div>
        <div><AlertTriangle /><span><strong>{overdue.length}</strong>Overdue</span></div>
        <div><CalendarDays /><span><strong>{activeReservations.length}</strong>Reservations</span></div>
      </div>
      <section className="panel"><div className="panel-heading"><h2><ShieldCheck />Circulation queue</h2><span>State-validated actions</span></div>
        <div className="responsive-table"><table><thead><tr><th>Book / member</th><th>Request</th><th>Submitted</th><th>Action</th></tr></thead><tbody>
          {queue.map((loan) => <tr key={loan.id}><td><strong>{bookFor(loan.bookId)?.title}</strong><small>{userFor(loan.userId)?.displayName}</small></td><td><span className={`status-chip ${loan.status}`}>{loan.status.replace("_", " ")}</span></td><td>{new Date(loan.requestedAt).toLocaleDateString()}</td><td className="table-actions">
            {loan.status === "requested" ? <><button className="small-button approve" disabled={busy} onClick={() => act({ type: "loan.approve", loanId: loan.id, version: loan.version }, "Loan approved.")}><Check />Approve</button><button className="small-button" disabled={busy} onClick={() => act({ type: "loan.reject", loanId: loan.id, version: loan.version }, "Request rejected.")}>Reject</button></> : <button className="small-button approve" disabled={busy} onClick={() => act({ type: "return.process", loanId: loan.id, version: loan.version }, "Return processed.")}>Process return</button>}
          </td></tr>)}
        </tbody></table></div>
        {!queue.length && <div className="compact-empty"><Check />The circulation queue is clear.</div>}
      </section>
      <div className="admin-columns">
        <section className="panel"><div className="panel-heading"><h2><AlertTriangle />Overdue & reservations</h2><span>{overdue.length + activeReservations.length}</span></div>
          {overdue.map((loan) => <div className="admin-list-row" key={loan.id}><span className="danger-dot" /><div><strong>{bookFor(loan.bookId)?.title}</strong><small>{userFor(loan.userId)?.displayName} · {dueLabel(loan)}</small></div></div>)}
          {activeReservations.map((reservation) => <div className="admin-list-row" key={reservation.id}><span className={`ready-dot ${reservation.status}`} /><div><strong>{bookFor(reservation.bookId)?.title}</strong><small>{userFor(reservation.userId)?.displayName} · reservation {reservation.status}</small></div></div>)}
        </section>
        <section className="panel"><div className="panel-heading"><h2><UserRound />Users & roles</h2><button className="small-button" onClick={onNewUser}><Plus />Add user</button></div>
          {snapshot.state.users.map((user) => <div className="admin-list-row" key={user.id}><span className="avatar small">{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div><select disabled={busy || user.id === snapshot.actor.id} value={user.role} onChange={(event) => act({ type: "user.role", userId: user.id, role: event.target.value as User["role"], version: user.version }, "Role updated.")}><option value="member">Member</option><option value="admin">Admin</option></select></div>)}
        </section>
      </div>
      <section className="panel"><div className="panel-heading"><h2><BookOpen />Catalog & shelf placement</h2><span>{snapshot.state.books.length} records</span></div>
        <div className="catalog-admin-list">
          {snapshot.state.books.slice(0, 12).map((book) => <div className="catalog-admin-row" key={book.id}><span className="mini-cover" style={{ background: book.coverColor }} /><div><strong>{book.title}</strong><small>{book.author} · {book.ddc}</small></div><select aria-label={`Shelf for ${book.title}`} value={book.shelfId} disabled={busy} onChange={(event) => act({ type: "book.place", bookId: book.id, shelfId: event.target.value, bin: book.bin, version: book.version }, "Shelf placement updated.")}>{snapshot.state.shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}</select><button className="small-button" onClick={() => onEditBook(book)}>Edit</button><button aria-label={`Delete ${book.title}`} className="icon-button danger" disabled={busy} onClick={() => { if (window.confirm(`Delete ${book.title}? Active loans block deletion.`)) act({ type: "book.delete", bookId: book.id, version: book.version }, "Book deleted."); }}><Trash2 /></button></div>)}
        </div>
      </section>
    </>
  );
}

function BookForm({ book, shelves, onClose, onSave }: { book: Book | null; shelves: Shelf[]; onClose: () => void; onSave: (book: Omit<Book, "id" | "version">) => void }) {
  const shelf = shelves.find((item) => item.id === book?.shelfId) ?? shelves[0];
  return <Modal title={book ? "Edit catalog book" : "Add catalog book"} onClose={onClose}>
    <form className="editor-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const selectedShelf = shelves.find((item) => item.id === data.get("shelfId")) ?? shelf;
      onSave({
        title: String(data.get("title")),
        author: String(data.get("author")),
        year: Number(data.get("year")),
        ddc: String(data.get("ddc")),
        kdc: String(data.get("kdc")),
        classIndex: Number(data.get("classIndex")),
        locationId: selectedShelf.locationId,
        shelfId: selectedShelf.id,
        bin: String(data.get("bin")),
        coverColor: String(data.get("coverColor")),
        demo: book?.demo ?? false,
      });
    }}>
      <label>Title<input name="title" required defaultValue={book?.title} /></label>
      <label>Author<input name="author" required defaultValue={book?.author} /></label>
      <div className="form-grid"><label>Year<input name="year" type="number" required min="1900" max="2100" defaultValue={book?.year ?? 2026} /></label><label>Broad class<select name="classIndex" defaultValue={book?.classIndex ?? 0}>{CLASS_LABELS.map((label, index) => <option key={label} value={index}>{index}00 {label}</option>)}</select></label></div>
      <div className="form-grid"><label>DDC<input name="ddc" required pattern="\\d{3}(\\.\\d+)?" defaultValue={book?.ddc ?? "000"} /></label><label>KDC<input name="kdc" required pattern="\\d{3}(\\.\\d+)?" defaultValue={book?.kdc ?? "000"} /></label></div>
      <div className="form-grid"><label>Shelf<select name="shelfId" defaultValue={shelf.id}>{shelves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Bin<input name="bin" required defaultValue={book?.bin ?? "A-1"} /></label></div>
      <label>Cover color<input name="coverColor" type="color" defaultValue={book?.coverColor ?? "#d97757"} /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check />Save book</button></div>
    </form>
  </Modal>;
}

function UserForm({ onClose, onSave }: { onClose: () => void; onSave: (user: Omit<User, "id" | "version">) => void }) {
  return <Modal title="Register user" onClose={onClose}><form className="editor-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({ displayName: String(data.get("displayName")), email: String(data.get("email")), authId: String(data.get("authId")), role: data.get("role") as User["role"] });
  }}><label>Display name<input name="displayName" required /></label><label>Email<input name="email" type="email" required /></label><label>Entra object ID<input name="authId" required /></label><label>Role<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Add user</button></div></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="modal" onClick={(event) => event.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X /></button></header>{children}</section></div>;
}

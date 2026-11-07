"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Box,
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
import AboutPage from "./about-page";
import Library3DPage from "./library-3d-page";
import { ABOUT_COPY, COPY, floorLabel, getBookDisplay, getClassLabel, getLocationDisplay, getShelfDisplay, type Copy, type Locale } from "@/lib/i18n";

const ShelfScene = dynamic(() => import("./shelf-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Loading...</div>,
});

type LoadedSnapshot = LibrarySnapshot & { actor: Actor };
type Tab = "explore" | "library3d" | "my-library" | "admin" | "about";
type StatusTone = "available" | "borrowed" | "requested";

function statusFor(book: Book, snapshot: LoadedSnapshot, copy: Copy = COPY.en): { label: string; tone: StatusTone } {
  const loan = snapshot.state.loans.find((item) => item.bookId === book.id && ["requested", "approved", "overdue", "return_requested"].includes(item.status));
  if (!loan) return { label: copy.availableStatus, tone: "available" };
  if (loan.status === "requested") return { label: copy.pendingStatus, tone: "requested" };
  const overdue = loan.status === "overdue" || Boolean(loan.dueAt && new Date(loan.dueAt).getTime() < Date.now());
  return { label: overdue ? copy.overdueStatus : copy.onLoanStatus, tone: "borrowed" };
}

function isOverdue(loan: Loan) {
  return loan.status === "overdue" || Boolean(
    loan.dueAt && ["approved", "return_requested"].includes(loan.status) && new Date(loan.dueAt).getTime() < Date.now(),
  );
}

function dueLabel(loan: Loan, locale: Locale, copy: Copy) {
  if (!loan.dueAt) return copy.awaitingApproval;
  const days = Math.ceil((new Date(loan.dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return locale === "ko" ? `${Math.abs(days)}${copy.overdueFor}` : `${Math.abs(days)} ${Math.abs(days) === 1 ? copy.day : copy.days} ${copy.overdueFor}`;
  if (days === 0) return copy.dueToday;
  return locale === "ko" ? `${copy.dueIn} ${days}${copy.days}` : `${copy.dueIn} ${days} ${days === 1 ? copy.day : copy.days}`;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function workflowStatus(value: string, locale: Locale) {
  if (locale !== "ko") return value.replace("_", " ");
  const labels: Record<string, string> = {
    requested: "신청",
    approved: "대출 중",
    overdue: "연체",
    return_requested: "반납 신청",
    returned: "반납 완료",
    rejected: "반려",
    waiting: "대기 중",
    ready: "수령 가능",
    fulfilled: "처리 완료",
    cancelled: "취소",
  };
  return labels[value] ?? value;
}

export default function LibraryApp() {
  const [snapshot, setSnapshot] = useState<LoadedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("explore");
  const [locale, setLocale] = useState<Locale>("en");
  const copy = COPY[locale];
  const [demoIdentity, setDemoIdentity] = useState<"member" | "admin">("member");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [classSystem, setClassSystem] = useState<"ddc" | "kdc">("ddc");
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [locatedBookId, setLocatedBookId] = useState<string | null>(null);
  /** The shelf the visitor stands in front of on the 3D library page; null is the whole-library view. */
  const [focusShelfId, setFocusShelfId] = useState<string | null>(null);
  const [viewRequest, setViewRequest] = useState(0);
  /** On narrow screens the drawer folds into a bar at the bottom while the 3D page shows a location. */
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const actorRole = snapshot?.actor.role;

  useEffect(() => {
    if (actorRole !== "admin" && tab === "admin") setTab("explore");
  }, [actorRole, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/library", {
        cache: "no-store",
        headers: { "x-demo-user": demoIdentity },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? COPY[locale].libraryUnavailable);
      setSnapshot(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : COPY[locale].libraryUnavailable);
    } finally {
      setLoading(false);
    }
  }, [demoIdentity, locale]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

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
      if (!response.ok) throw new Error(body.error ?? COPY[locale].updateFailed);
      setNotice(success ?? COPY[locale].savedSuccessfully);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : COPY[locale].updateFailed);
    } finally {
      setBusy(false);
    }
  }, [demoIdentity, load, locale]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** Every request moves the camera, even to the shelf it is already at. */
  const focusShelf = useCallback((shelfId: string | null) => {
    setFocusShelfId(shelfId);
    setViewRequest((count) => count + 1);
  }, []);

  // Esc steps back out: from a shelf to the whole library, then closes the book details.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || showBookForm || showUserForm) return;
      if (tab === "library3d" && focusShelfId) focusShelf(null);
      else if (selectedBookId) setSelectedBookId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusShelf, focusShelfId, selectedBookId, showBookForm, showUserForm, tab]);

  const openBook = useCallback((bookId: string) => {
    setSelectedBookId(bookId);
    setDrawerCollapsed(false);
  }, []);

  const statusOf = useCallback(
    (book: Book) => (snapshot ? statusFor(book, snapshot, COPY[locale]) : { label: "", tone: "available" as StatusTone }),
    [locale, snapshot],
  );

  const filteredBooks = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLowerCase();
    return snapshot.state.books.filter((book) => {
      const shelfMatch = !selectedShelfId || book.shelfId === selectedShelfId;
      const classMatch = classFilter === null || book.classIndex === classFilter;
      const display = getBookDisplay(book, locale);
      const textMatch = !needle || `${book.title} ${book.author} ${display.title} ${display.author} ${book.ddc} ${book.kdc}`.toLowerCase().includes(needle);
      return shelfMatch && classMatch && textMatch;
    });
  }, [classFilter, locale, query, selectedShelfId, snapshot]);

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
    return <main className="loading-screen"><Library size={42} /><h1>{copy.openingLibrary}</h1><p>{copy.loadingCollection}</p><div className="loading-line" /></main>;
  }

  if (!snapshot) {
    return (
      <main className="loading-screen error-state">
        <AlertTriangle size={42} />
        <h1>{copy.openFailed}</h1>
        <p>{error}</p>
        <div className="drawer-actions">
          <Link className="primary-button" href="/api/auth/signin">{copy.signIn}</Link>
          <button className="secondary-button" onClick={load}>{copy.tryAgain}</button>
        </div>
      </main>
    );
  }

  const modeLabel = snapshot.mode === "demo" ? copy.localDemo : copy.oneDriveExcel;
  const drawerDocked = tab === "library3d" && Boolean(selectedBook);
  const shellClass = ["app-shell", drawerDocked && "drawer-docked", drawerDocked && drawerCollapsed && "drawer-collapsed"].filter(Boolean).join(" ");

  return (
    <div className={shellClass}>
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label={copy.openMenu} onClick={() => setNavOpen(true)}><Menu /></button>
        <div className="wordmark"><span className="logo-mark"><BookOpen /></span><div><strong>DURUME</strong><span>3D LIBRARY</span></div></div>
        <label className="global-search">
          <Search size={18} />
          <input aria-label={copy.searchBooks} placeholder={copy.searchPlaceholder} value={query} onChange={(event) => { setQuery(event.target.value); setTab("explore"); }} />
          <kbd>/</kbd>
        </label>
        <div className="top-actions">
          <select className="language-select" aria-label={copy.language} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">English</option><option value="ko">한국어</option></select>
          <span className={`mode-badge ${snapshot.mode}`}><span />{modeLabel}</span>
          <button className="icon-button notification-button" aria-label={copy.notifications} onClick={() => setTab("my-library")}>
            <Bell /><b>{ownReservations.filter((item) => item.status === "ready").length + ownLoans.filter((item) => item.status === "requested" || isOverdue(item)).length}</b>
          </button>
          {snapshot.mode === "demo" ? (
            <select className="identity-select" aria-label={copy.demoIdentity} value={demoIdentity} onChange={(event) => setDemoIdentity(event.target.value as "member" | "admin")}>
              <option value="member">{copy.memberView}</option>
              <option value="admin">{copy.adminView}</option>
            </select>
          ) : (
            <Link className="avatar" href="/api/auth/signout" title={copy.signOut}>{initials(actorUser?.displayName ?? "U")}</Link>
          )}
        </div>
      </header>

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="sidebar-mobile-head"><strong>{copy.menu}</strong><button className="icon-button" aria-label={copy.closeMenu} onClick={() => setNavOpen(false)}><X /></button></div>
        <nav>
          <p>{copy.library}</p>
          <button className={tab === "explore" ? "active" : ""} onClick={() => { setTab("explore"); setNavOpen(false); }}><Library />{copy.exploreShelves}</button>
          <button className={tab === "library3d" ? "active" : ""} onClick={() => { setTab("library3d"); setNavOpen(false); }}><Box />{copy.library3d}</button>
          <button className={tab === "my-library" ? "active" : ""} onClick={() => { setTab("my-library"); setNavOpen(false); }}><BookOpen />{copy.myLibrary} <small>{ownLoans.filter((loan) => loan.status !== "returned" && loan.status !== "rejected").length}</small></button>
          {snapshot.actor.role === "admin" && <>
            <p>{copy.manage}</p>
            <button className={tab === "admin" ? "active" : ""} onClick={() => { setTab("admin"); setNavOpen(false); }}><ShieldCheck />{copy.adminDesk}</button>
          </>}
          <p>{copy.collection}</p>
          <button onClick={() => { setTab("explore"); setQuery(""); setSelectedShelfId(null); setClassFilter(null); setNavOpen(false); }}><Layers3 />{copy.allBooks} <small>{snapshot.state.books.length}</small></button>
          <button onClick={() => { setTab("explore"); setClassFilter(9); setNavOpen(false); }}><Clock3 />{copy.recentlyAdded}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><span className="avatar">{initials(actorUser?.displayName ?? "Demo")}</span><div><strong>{actorUser?.displayName}</strong><span>{actorUser?.role === "admin" ? copy.librarian : copy.member} {copy.account}</span></div></div>
          <button className={tab === "about" ? "active" : ""} onClick={() => { setTab("about"); setNavOpen(false); }}><CircleHelp />{copy.helpGuides}</button>
        </div>
      </aside>
      {navOpen && <button aria-label={copy.closeMenu} className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <main className="main-content">
        {error && <div className="alert error"><AlertTriangle /> <span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
        {notice && <div className="alert success"><Check />{notice}</div>}

        {tab === "explore" && (
          <>
            <div className="page-heading">
              <div><span className="eyebrow">{copy.collectionInSpace}</span><h1>{copy.nextRead}</h1><p>{copy.exploreDescription}</p></div>
              <div className="heading-stats"><span><strong>{snapshot.state.books.length}</strong> {copy.books}</span><i /><span><strong>{available}</strong> {copy.available}</span><i /><span><strong>{snapshot.state.shelves.length}</strong> {copy.shelves}</span></div>
            </div>
            <aside className="mission-strip">
              <span className="mvp-badge"><Award />Microsoft MVP</span>
              <p>{ABOUT_COPY[locale].missionStrip}</p>
              <button type="button" onClick={() => setTab("about")}>{ABOUT_COPY[locale].missionLink}<ChevronRight /></button>
            </aside>

            <section className="scene-card">
              <div className="scene-toolbar">
                <div><span className="live-dot" /><strong>{copy.interactiveFloorPlan}</strong></div>
                <div className="scene-toolbar-actions">
                  <div className="scene-location"><MapPin />{selectedShelf ? `${getShelfDisplay(selectedShelf, locale)} · ${floorLabel(selectedShelf.floor, locale)}` : copy.allLocations}<SlidersHorizontal /></div>
                  <button className="open-3d" aria-label={copy.open3dLibrary} onClick={() => { focusShelf(selectedShelfId); setTab("library3d"); }}><Box /><span>{copy.open3dLibrary}</span></button>
                </div>
              </div>
              <div className="scene-wrap">
                <ShelfScene shelves={snapshot.state.shelves} books={snapshot.state.books} locale={locale} selectedShelfId={selectedShelfId} highlightedBookId={locatedBookId} onSelect={(id) => setSelectedShelfId(selectedShelfId === id ? null : id)} />
                <div className="scene-hint"><span>↔</span> {copy.dragHint} <b>·</b> {copy.zoomHint} <b>·</b> {copy.clickShelf}</div>
              </div>
              <div className="scene-legend">
                <span className="legend-title">{copy.locations}</span>
                {snapshot.state.locations.map((location) => <button key={location.id} onClick={() => { setSelectedShelfId(snapshot.state.shelves.find((shelf) => shelf.locationId === location.id)?.id ?? null); }}><i style={{ background: ["#b95638", "#65827b", "#9c8055"][snapshot.state.locations.indexOf(location)] }} />{getLocationDisplay(location, locale)}</button>)}
                {selectedShelfId && <button className="clear-filter" onClick={() => setSelectedShelfId(null)}>{copy.clearShelf}</button>}
              </div>
            </section>

            <div className="content-heading"><div><span className="eyebrow">{copy.catalog}</span><h2>{selectedShelf ? `${getShelfDisplay(selectedShelf, locale)} ${copy.collectionSuffix}` : copy.browseCollection}</h2></div><p>{filteredBooks.length} {copy.booksFound}</p></div>
            <div className="class-system-selector" role="group" aria-label={copy.classificationSystem}>
              <span>{copy.classification}</span>
              <button className={classSystem === "ddc" ? "active" : ""} onClick={() => setClassSystem("ddc")}>DDC</button>
              <button className={classSystem === "kdc" ? "active" : ""} onClick={() => setClassSystem("kdc")}>KDC</button>
            </div>
            <div className="class-filters">
              <button className={classFilter === null ? "active" : ""} onClick={() => setClassFilter(null)}>{copy.allClasses}</button>
              {CLASS_LABELS.map((label, index) => <button key={label} className={classFilter === index ? "active" : ""} onClick={() => setClassFilter(index)}>{index}00 <span>{getClassLabel(index, locale) ?? label.split(" ")[0]}</span></button>)}
            </div>

            <div className="book-grid">
              {visibleBooks.map((book) => {
                const status = statusFor(book, snapshot, copy);
                const shelf = snapshot.state.shelves.find((item) => item.id === book.shelfId);
                const display = getBookDisplay(book, locale);
                return (
                  <button className="book-card" key={book.id} onClick={() => { openBook(book.id); setLocatedBookId(null); }}>
                    <div className="book-cover" style={{ background: book.coverColor }}>
                      <span className="book-class">{classSystem === "ddc" ? book.ddc : book.kdc}</span>
                      <BookOpen size={28} />
                      <strong>{display.title}</strong>
                      <small>{display.author}</small>
                    </div>
                    <div className="book-meta">
                      <span className={`availability ${status.tone}`}><i />{status.label}</span>
                      <h3>{display.title}</h3>
                      <p>{display.author}</p>
                      <span className="location-line"><MapPin />{shelf ? getShelfDisplay(shelf, locale) : ""} · {book.bin}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {visibleBooks.length === 0 && <div className="empty-state"><Search /><h3>{copy.noMatchingBooks}</h3><p>{copy.adjustSearch}</p></div>}
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft />{copy.previous}</button>
              <span>{copy.page} <strong>{page + 1}</strong> {copy.of} {pageCount}</span>
              <button disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>{copy.next}<ChevronRight /></button>
            </div>
          </>
        )}

        {tab === "library3d" && (
          <Library3DPage
            state={snapshot.state}
            locale={locale}
            copy={copy}
            classSystem={classSystem}
            focusShelfId={focusShelfId}
            viewRequest={viewRequest}
            onFocusShelf={focusShelf}
            locatedBookId={locatedBookId}
            onClearLocated={() => setLocatedBookId(null)}
            onOpenBook={openBook}
            onShowShelfInList={(shelfId) => { setQuery(""); setClassFilter(null); setSelectedShelfId(shelfId); setTab("explore"); }}
            statusOf={statusOf}
          />
        )}

        {tab === "about" && <AboutPage locale={locale} open3dLabel={copy.open3dLibrary} onOpen3d={() => { focusShelf(null); setTab("library3d"); }} />}

        {tab === "my-library" && (
          <MemberDashboard snapshot={snapshot} ownLoans={ownLoans} ownReservations={ownReservations} busy={busy} act={act} locale={locale} copy={copy} />
        )}

        {tab === "admin" && snapshot.actor.role === "admin" && (
          <AdminDashboard
            snapshot={snapshot}
            busy={busy}
            act={act}
            locale={locale}
            copy={copy}
            onNewBook={() => { setEditingBook(null); setShowBookForm(true); }}
            onEditBook={(book) => { setEditingBook(book); setShowBookForm(true); }}
            onNewUser={() => setShowUserForm(true)}
          />
        )}
      </main>

      {selectedBook && (() => {
        const display = getBookDisplay(selectedBook, locale);
        const shelf = snapshot.state.shelves.find((item) => item.id === selectedBook.shelfId);
        const location = snapshot.state.locations.find((item) => item.id === selectedBook.locationId);
        const status = statusFor(selectedBook, snapshot, copy);
        const locating = tab === "library3d" && locatedBookId === selectedBook.id;
        return (
          // On the 3D page the drawer is docked: no dimming, and the scene stays usable beside it.
          <div className={`drawer-backdrop${drawerDocked ? " docked" : ""}`} onClick={() => { if (!drawerDocked) setSelectedBookId(null); }}>
            <aside className={`book-drawer${drawerDocked ? " docked" : ""}${drawerDocked && drawerCollapsed ? " collapsed" : ""}`} onClick={(event) => event.stopPropagation()}>
              <div className="drawer-bar">
                <div><strong>{display.title}</strong><span>{shelf ? `${getShelfDisplay(shelf, locale)} · ${copy.bin} ${selectedBook.bin}` : copy.notShelved}</span></div>
                <button className="secondary-button" onClick={() => setDrawerCollapsed(false)}>{copy.expandDetails}</button>
              </div>
              <button className="drawer-close icon-button" aria-label={copy.closeDetails} onClick={() => setSelectedBookId(null)}><X /></button>
              <div className="drawer-cover" style={{ background: selectedBook.coverColor }}><BookOpen /><span>{classSystem === "ddc" ? selectedBook.ddc : selectedBook.kdc}</span><strong>{display.title}</strong></div>
              <span className="eyebrow">{classSystem.toUpperCase()} · {getClassLabel(selectedBook.classIndex, locale) ?? CLASS_LABELS[selectedBook.classIndex]}</span>
              <h2>{display.title}</h2>
              <p className="drawer-author">{display.author} · {selectedBook.year}</p>
              <div className="code-pills"><span>DDC {selectedBook.ddc}</span><span>KDC {selectedBook.kdc}</span></div>
              <button
                className={`detail-location${locating ? " locating" : ""}`}
                title={copy.viewBookLocation}
                disabled={!shelf}
                onClick={() => { setLocatedBookId(selectedBook.id); focusShelf(selectedBook.shelfId); setDrawerCollapsed(true); setTab("library3d"); }}
              >
                <MapPin /><div><strong>{shelf ? getShelfDisplay(shelf, locale) : copy.notShelved}</strong><span>{location ? getLocationDisplay(location, locale) : ""} · {floorLabel(location?.floor, locale)} · {copy.bin} {selectedBook.bin}</span></div>
                {shelf && <span className="location-action">{locating ? copy.showingLocation : `${copy.viewOnShelf} ↗`}</span>}
              </button>
              <span className={`availability large ${status.tone}`}><i />{status.label}</span>
              <p className="demo-note">{selectedBook.demo ? copy.demoNote : copy.catalogNote}</p>
              <div className="drawer-actions">
                {status.tone === "available" ? (
                  <button className="primary-button" disabled={busy} onClick={() => act({ type: "loan.request", bookId: selectedBook.id })}>{copy.requestLoan}</button>
                ) : (
                  <button className="primary-button" disabled={busy || ownReservations.some((item) => item.bookId === selectedBook.id && ["waiting", "ready"].includes(item.status))} onClick={() => act({ type: "reservation.request", bookId: selectedBook.id })}>{copy.reserveNext}</button>
                )}
                {snapshot.actor.role === "admin" && <button className="secondary-button" onClick={() => { setEditingBook(selectedBook); setShowBookForm(true); setSelectedBookId(null); }}><Settings />{copy.edit}</button>}
              </div>
            </aside>
          </div>
        );
      })()}

      {showBookForm && snapshot.actor.role === "admin" && (
        <BookForm book={editingBook} shelves={snapshot.state.shelves} locale={locale} copy={copy} onClose={() => setShowBookForm(false)} onSave={(book) => {
          if (editingBook) void act({ type: "book.update", bookId: editingBook.id, version: editingBook.version, book });
          else void act({ type: "book.create", book: book as Omit<Book, "id" | "version"> });
          setShowBookForm(false);
        }} />
      )}
      {showUserForm && <UserForm copy={copy} onClose={() => setShowUserForm(false)} onSave={(user) => { void act({ type: "user.create", user }); setShowUserForm(false); }} />}
    </div>
  );
}

function MemberDashboard({ snapshot, ownLoans, ownReservations, busy, act, locale, copy }: {
  snapshot: LoadedSnapshot;
  ownLoans: Loan[];
  ownReservations: Reservation[];
  busy: boolean;
  act: (action: LibraryAction, success?: string) => Promise<void>;
  locale: Locale;
  copy: Copy;
}) {
  const active = ownLoans.filter((loan) => !["returned", "rejected"].includes(loan.status));
  const notices = [
    ...ownLoans.filter(isOverdue).map((loan) => { const book = snapshot.state.books.find((item) => item.id === loan.bookId); return { key: loan.id, title: copy.bookOverdue, text: `${book ? getBookDisplay(book, locale).title : loan.bookId} ${copy.mustReturn}`, tone: "danger" }; }),
    ...ownReservations.filter((reservation) => reservation.status === "ready").map((reservation) => { const book = snapshot.state.books.find((item) => item.id === reservation.bookId); return { key: reservation.id, title: copy.reservationReady, text: `${book ? getBookDisplay(book, locale).title : reservation.bookId} ${copy.readyPickup}`, tone: "ready" }; }),
    ...ownLoans.filter((loan) => loan.status === "approved").map((loan) => { const book = snapshot.state.books.find((item) => item.id === loan.bookId); return { key: loan.id, title: copy.loanApproved, text: `${book ? getBookDisplay(book, locale).title : loan.bookId} ${copy.nowOnLoan}`, tone: "ready" }; }),
  ];
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">{copy.personalDesk}</span><h1>{copy.myLibrary}</h1><p>{copy.personalDescription}</p></div></div>
      <div className="member-stats">
        <div><BookOpen /><span><strong>{active.length}</strong>{copy.activeLoans}</span></div>
        <div><CalendarDays /><span><strong>{active.filter(isOverdue).length}</strong>{copy.overdue}</span></div>
        <div><Clock3 /><span><strong>{ownReservations.filter((item) => ["waiting", "ready"].includes(item.status)).length}</strong>{copy.reservations}</span></div>
      </div>
      <section className="panel notice-panel"><div className="panel-heading"><h2><Bell />{copy.notifications}</h2><span>{notices.length} {copy.inApp}</span></div>
        {notices.length ? notices.map((notice) => <div className={`notice-row ${notice.tone}`} key={notice.key}><span><Bell /></span><div><strong>{notice.title}</strong><p>{notice.text}</p></div></div>) : <div className="compact-empty"><Check />{copy.allCaughtUp}</div>}
      </section>
      <section className="panel"><div className="panel-heading"><h2><BookOpen />{copy.myLoans}</h2><span>{active.length} {copy.active}</span></div>
        <div className="responsive-table">
          <table><thead><tr><th>{copy.book}</th><th>{copy.status}</th><th>{copy.due}</th><th></th></tr></thead><tbody>
            {ownLoans.map((loan) => {
              const book = snapshot.state.books.find((item) => item.id === loan.bookId);
              const display = book ? getBookDisplay(book, locale) : { title: loan.bookId, author: "" };
              return <tr key={loan.id}><td><strong>{display.title}</strong><small>{display.author}</small></td><td><span className={`status-chip ${loan.status}`}>{workflowStatus(loan.status, locale)}</span></td><td>{dueLabel(loan, locale, copy)}</td><td>{["approved", "overdue"].includes(loan.status) ? <button className="small-button" disabled={busy} onClick={() => act({ type: "return.request", loanId: loan.id })}>{copy.requestReturn}</button> : <span>—</span>}</td></tr>;
            })}
          </tbody></table>
        </div>
        {!ownLoans.length && <div className="compact-empty">{copy.noLoans}</div>}
      </section>
      <section className="panel"><div className="panel-heading"><h2><Clock3 />{copy.myReservations}</h2><span>{copy.queuePreserved}</span></div>
        {ownReservations.map((reservation) => { const book = snapshot.state.books.find((item) => item.id === reservation.bookId); return <div className="reservation-row" key={reservation.id}><div><strong>{book ? getBookDisplay(book, locale).title : reservation.bookId}</strong><span>{workflowStatus(reservation.status, locale)} · {new Date(reservation.createdAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en")}</span></div>{["waiting", "ready"].includes(reservation.status) && <button className="text-button" disabled={busy} onClick={() => act({ type: "reservation.cancel", reservationId: reservation.id })}>{copy.cancel}</button>}</div>; })}
        {!ownReservations.length && <div className="compact-empty">{copy.noReservations}</div>}
      </section>
    </>
  );
}

function AdminDashboard({ snapshot, busy, act, onNewBook, onEditBook, onNewUser, locale, copy }: {
  snapshot: LoadedSnapshot;
  busy: boolean;
  act: (action: LibraryAction, success?: string) => Promise<void>;
  locale: Locale;
  copy: Copy;
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
      <div className="page-heading"><div><span className="eyebrow">{copy.librarianWorkspace}</span><h1>{copy.adminDesk}</h1><p>{copy.adminDescription}</p></div><button className="primary-button" onClick={onNewBook}><Plus />{copy.newBook}</button></div>
      <div className="member-stats">
        <div><Clock3 /><span><strong>{queue.length}</strong>{copy.needsAction}</span></div>
        <div><AlertTriangle /><span><strong>{overdue.length}</strong>{copy.overdue}</span></div>
        <div><CalendarDays /><span><strong>{activeReservations.length}</strong>{copy.reservations}</span></div>
      </div>
      <section className="panel"><div className="panel-heading"><h2><ShieldCheck />{copy.circulationQueue}</h2><span>{copy.stateValidated}</span></div>
        <div className="responsive-table"><table><thead><tr><th>{copy.bookMember}</th><th>{copy.request}</th><th>{copy.submitted}</th><th>{copy.action}</th></tr></thead><tbody>
          {queue.map((loan) => { const book = bookFor(loan.bookId); return <tr key={loan.id}><td><strong>{book ? getBookDisplay(book, locale).title : loan.bookId}</strong><small>{userFor(loan.userId)?.displayName}</small></td><td><span className={`status-chip ${loan.status}`}>{workflowStatus(loan.status, locale)}</span></td><td>{new Date(loan.requestedAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en")}</td><td className="table-actions">
            {loan.status === "requested" ? <><button className="small-button approve" disabled={busy} onClick={() => act({ type: "loan.approve", loanId: loan.id, version: loan.version })}><Check />{copy.approve}</button><button className="small-button" disabled={busy} onClick={() => act({ type: "loan.reject", loanId: loan.id, version: loan.version })}>{copy.reject}</button></> : <button className="small-button approve" disabled={busy} onClick={() => act({ type: "return.process", loanId: loan.id, version: loan.version })}>{copy.processReturn}</button>}
          </td></tr>; })}
        </tbody></table></div>
        {!queue.length && <div className="compact-empty"><Check />{copy.queueClear}</div>}
      </section>
      <div className="admin-columns">
        <section className="panel"><div className="panel-heading"><h2><AlertTriangle />{copy.overdueReservations}</h2><span>{overdue.length + activeReservations.length}</span></div>
          {overdue.map((loan) => { const book = bookFor(loan.bookId); return <div className="admin-list-row" key={loan.id}><span className="danger-dot" /><div><strong>{book ? getBookDisplay(book, locale).title : loan.bookId}</strong><small>{userFor(loan.userId)?.displayName} · {dueLabel(loan, locale, copy)}</small></div></div>; })}
          {activeReservations.map((reservation) => { const book = bookFor(reservation.bookId); return <div className="admin-list-row" key={reservation.id}><span className={`ready-dot ${reservation.status}`} /><div><strong>{book ? getBookDisplay(book, locale).title : reservation.bookId}</strong><small>{userFor(reservation.userId)?.displayName} · {copy.reservation} {workflowStatus(reservation.status, locale)}</small></div></div>; })}
        </section>
        <section className="panel"><div className="panel-heading"><h2><UserRound />{copy.usersRoles}</h2><button className="small-button" onClick={onNewUser}><Plus />{copy.addUser}</button></div>
          {snapshot.state.users.map((user) => <div className="admin-list-row" key={user.id}><span className="avatar small">{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div><select disabled={busy || user.id === snapshot.actor.id} value={user.role} onChange={(event) => act({ type: "user.role", userId: user.id, role: event.target.value as User["role"], version: user.version })}><option value="member">{copy.member}</option><option value="admin">{copy.librarian}</option></select></div>)}
        </section>
      </div>
      <section className="panel"><div className="panel-heading"><h2><BookOpen />{copy.catalogPlacement}</h2><span>{snapshot.state.books.length} {copy.records}</span></div>
        <div className="catalog-admin-list">
          {snapshot.state.books.slice(0, 12).map((book) => { const display = getBookDisplay(book, locale); return <div className="catalog-admin-row" key={book.id}><span className="mini-cover" style={{ background: book.coverColor }} /><div><strong>{display.title}</strong><small>{display.author} · {book.ddc}</small></div><select aria-label={`${copy.shelfFor} ${display.title}`} value={book.shelfId} disabled={busy} onChange={(event) => act({ type: "book.place", bookId: book.id, shelfId: event.target.value, bin: book.bin, version: book.version })}>{snapshot.state.shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{getShelfDisplay(shelf, locale)}</option>)}</select><button className="small-button" onClick={() => onEditBook(book)}>{copy.edit}</button><button aria-label={`${copy.delete} ${display.title}`} className="icon-button danger" disabled={busy} onClick={() => { if (window.confirm(`${copy.deleteBook}\n${display.title}`)) act({ type: "book.delete", bookId: book.id, version: book.version }); }}><Trash2 /></button></div>; })}
        </div>
      </section>
    </>
  );
}

function BookForm({ book, shelves, locale, copy, onClose, onSave }: { book: Book | null; shelves: Shelf[]; locale: Locale; copy: Copy; onClose: () => void; onSave: (book: Omit<Book, "id" | "version">) => void }) {
  const shelf = shelves.find((item) => item.id === book?.shelfId) ?? shelves[0];
  return <Modal title={book ? copy.editCatalogBook : copy.addCatalogBook} onClose={onClose}>
    <form className="editor-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const selectedShelf = shelves.find((item) => item.id === data.get("shelfId")) ?? shelf;
      onSave({
        title: String(data.get("title")),
        author: String(data.get("author")),
        titleKo: String(data.get("titleKo") ?? "").trim() || null,
        authorKo: String(data.get("authorKo") ?? "").trim() || null,
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
      <label>{copy.title} (English)<input name="title" required defaultValue={book?.title} /></label>
      <label>{copy.author} (English)<input name="author" required defaultValue={book?.author} /></label>
      <div className="form-grid"><label>한국어 제목<input name="titleKo" defaultValue={book?.titleKo ?? ""} /></label><label>한국어 저자<input name="authorKo" defaultValue={book?.authorKo ?? ""} /></label></div>
      <div className="form-grid"><label>{copy.year}<input name="year" type="number" required min="1900" max="2100" defaultValue={book?.year ?? 2026} /></label><label>{copy.broadClass}<select name="classIndex" defaultValue={book?.classIndex ?? 0}>{CLASS_LABELS.map((label, index) => <option key={label} value={index}>{index}00 {getClassLabel(index, locale) ?? label}</option>)}</select></label></div>
      <div className="form-grid"><label>DDC<input name="ddc" required pattern="\\d{3}(\\.\\d+)?" defaultValue={book?.ddc ?? "000"} /></label><label>KDC<input name="kdc" required pattern="\\d{3}(\\.\\d+)?" defaultValue={book?.kdc ?? "000"} /></label></div>
      <div className="form-grid"><label>{copy.shelf}<select name="shelfId" defaultValue={shelf.id}>{shelves.map((item) => <option key={item.id} value={item.id}>{getShelfDisplay(item, locale)}</option>)}</select></label><label>{copy.bin}<input name="bin" required defaultValue={book?.bin ?? "A-1"} /></label></div>
      <label>{copy.coverColor}<input name="coverColor" type="color" defaultValue={book?.coverColor ?? "#d97757"} /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>{copy.cancel}</button><button className="primary-button" type="submit"><Check />{copy.saveBook}</button></div>
    </form>
  </Modal>;
}

function UserForm({ copy, onClose, onSave }: { copy: Copy; onClose: () => void; onSave: (user: Omit<User, "id" | "version">) => void }) {
  return <Modal title={copy.registerUser} onClose={onClose}><form className="editor-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({ displayName: String(data.get("displayName")), email: String(data.get("email")), authId: String(data.get("authId")), role: data.get("role") as User["role"] });
  }}><label>{copy.displayName}<input name="displayName" required /></label><label>{copy.email}<input name="email" type="email" required /></label><label>{copy.entraId}<input name="authId" required /></label><label>{copy.role}<select name="role"><option value="member">{copy.member}</option><option value="admin">{copy.librarian}</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>{copy.cancel}</button><button className="primary-button" type="submit">{copy.addUser}</button></div></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="modal" onClick={(event) => event.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X /></button></header>{children}</section></div>;
}

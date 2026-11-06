"use client";

import dynamic from "next/dynamic";
import { BookOpen, ChevronLeft, ChevronRight, LayoutGrid, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Book, LibraryState, Shelf } from "@/lib/domain";
import { fill, floorLabel, getBookDisplay, getLocationDisplay, getShelfDisplay, type Copy, type Locale } from "@/lib/i18n";
import { SHELVES_PER_ROW, gridFor, layoutShelfBooks, parseBin, type Slot } from "@/lib/shelf-layout";
import type { ScenePointer, SceneTarget } from "./shelf-scene";

const ShelfScene = dynamic(() => import("./shelf-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Loading...</div>,
});

type Status = { label: string; tone: string };

type Props = {
  state: LibraryState;
  locale: Locale;
  copy: Copy;
  classSystem: "ddc" | "kdc";
  focusShelfId: string | null;
  /** Counts requests to move the camera; see ShelfScene. */
  viewRequest: number;
  onFocusShelf: (shelfId: string | null) => void;
  locatedBookId: string | null;
  onClearLocated: () => void;
  onOpenBook: (bookId: string) => void;
  onShowShelfInList: (shelfId: string) => void;
  statusOf: (book: Book) => Status;
};

const SHOW_DELAY = 120;
const HIDE_DELAY = 80;
const TOOLTIP_WIDTH = 260;
const TOOLTIP_HEIGHT = 150;
/** Room kept above the scene for the fixed header (taller on phones, where search sits under it). */
const TOP_CLEARANCE = 130;
/** Room kept below the scene for the folded drawer bar. */
const BOTTOM_CLEARANCE = 80;

/** Where a book sits, in words, and whether that is exactly where its bin says. */
export function describePlace(book: Book, shelf: Shelf, slot: Slot | undefined, locale: Locale, copy: Copy) {
  const parsed = parseBin(book.bin);
  const exact = Boolean(slot && parsed && parsed.level === slot.level && parsed.column === slot.column);
  const sentence = slot
    ? fill(copy.locatedPosition, { shelf: getShelfDisplay(shelf, locale), level: slot.level + 1, column: slot.column + 1 })
    : getShelfDisplay(shelf, locale);
  return { sentence, exact };
}

export default function Library3DPage({ state, locale, copy, classSystem, focusShelfId, viewRequest, onFocusShelf, locatedBookId, onClearLocated, onOpenBook, onShowShelfInList, statusOf }: Props) {
  const { shelves, books, locations } = state;
  const grid = useMemo(() => gridFor(books), [books]);
  const booksByShelf = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const book of books) {
      const list = map.get(book.shelfId);
      if (list) list.push(book);
      else map.set(book.shelfId, [book]);
    }
    return map;
  }, [books]);
  const absentBookIds = useMemo(() => new Set(books.filter((book) => statusOf(book).tone === "borrowed").map((book) => book.id)), [books, statusOf]);

  const focusIndex = shelves.findIndex((shelf) => shelf.id === focusShelfId);
  const focusShelf = focusIndex >= 0 ? shelves[focusIndex] : null;
  const focusColumn = focusIndex % SHELVES_PER_ROW;
  const leftShelf = focusShelf && focusColumn > 0 ? shelves[focusIndex - 1] : null;
  const rightShelf = focusShelf && focusColumn < SHELVES_PER_ROW - 1 ? shelves[focusIndex + 1] ?? null : null;
  const focusLocation = focusShelf ? locations.find((location) => location.id === focusShelf.locationId) : undefined;

  /** Slots on the shelves that need them: the one the visitor stands at and the one holding the located book. */
  const slotsOn = useCallback((shelfId: string) => layoutShelfBooks(booksByShelf.get(shelfId) ?? [], grid, locatedBookId), [booksByShelf, grid, locatedBookId]);
  const focusSlots = useMemo(() => (focusShelf ? slotsOn(focusShelf.id) : new Map<string, Slot>()), [focusShelf, slotsOn]);

  const locatedBook = books.find((book) => book.id === locatedBookId) ?? null;
  const locatedShelf = locatedBook ? shelves.find((shelf) => shelf.id === locatedBook.shelfId) ?? null : null;
  const locatedPlace = useMemo(() => {
    if (!locatedBook || !locatedShelf) return null;
    return describePlace(locatedBook, locatedShelf, slotsOn(locatedShelf.id).get(locatedBook.id), locale, copy);
  }, [copy, locale, locatedBook, locatedShelf, slotsOn]);

  const focusTotal = focusShelf ? booksByShelf.get(focusShelf.id)?.length ?? 0 : 0;
  const capacity = grid.levels * grid.columns;

  // Touch screens have no hover: a tap on a book opens a card instead of the tooltip.
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(window.matchMedia?.("(hover: none)").matches ?? false); }, []);
  const [touchCardId, setTouchCardId] = useState<string | null>(null);
  useEffect(() => { setTouchCardId(null); }, [focusShelfId]);

  // The hovered item is highlighted at once; the tooltip waits a moment so it does not flicker
  // while the pointer crosses the scene, then follows the pointer without re-rendering React.
  const [hovered, setHovered] = useState<SceneTarget | null>(null);
  const [tip, setTip] = useState<SceneTarget | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const pointer = useRef<ScenePointer>({ x: 0, y: 0, type: "mouse" });
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const tipShown = useRef(false);

  const placeTooltip = useCallback(() => {
    const element = tooltip.current;
    const area = wrap.current;
    if (!element || !area) return;
    const { x, y } = pointer.current;
    const left = x + 16 + TOOLTIP_WIDTH > area.clientWidth ? x - 16 - TOOLTIP_WIDTH : x + 16;
    const top = y + 16 + TOOLTIP_HEIGHT > area.clientHeight ? y - 12 - TOOLTIP_HEIGHT : y + 16;
    element.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  }, []);

  const hideTip = useCallback(() => {
    window.clearTimeout(showTimer.current);
    showTimer.current = undefined;
    tipShown.current = false;
    setTip(null);
  }, []);

  const onHover = useCallback((target: SceneTarget | null, at: ScenePointer) => {
    if (at.type === "touch") return;
    pointer.current = at;
    setHovered((current) => (current?.kind === target?.kind && current?.id === target?.id ? current : target));
    window.clearTimeout(hideTimer.current);
    if (!target) {
      window.clearTimeout(showTimer.current);
      showTimer.current = undefined;
      hideTimer.current = window.setTimeout(hideTip, HIDE_DELAY);
      return;
    }
    if (tipShown.current) {
      setTip((current) => (current?.kind === target.kind && current.id === target.id ? current : target));
      placeTooltip();
      return;
    }
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      showTimer.current = undefined;
      tipShown.current = true;
      setTip(target);
    }, SHOW_DELAY);
  }, [hideTip, placeTooltip]);

  useEffect(() => { if (tip) placeTooltip(); }, [placeTooltip, tip]);

  // A newly located book is useless below the fold: bring the scene into view, clear of the fixed
  // header and the folded drawer bar. (scrollIntoView stops at the clipping scene card, so measure.)
  useEffect(() => {
    const area = wrap.current;
    if (!locatedBookId || !area) return;
    const rect = area.getBoundingClientRect();
    if (rect.height === 0) return;
    const below = rect.bottom + BOTTOM_CLEARANCE - window.innerHeight;
    const above = TOP_CLEARANCE - rect.top;
    const by = below > 0 ? Math.min(below, rect.top - TOP_CLEARANCE) : above > 0 ? -above : 0;
    if (by === 0) return;
    const smooth = !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    window.scrollBy({ top: by, behavior: smooth ? "smooth" : "auto" });
  }, [locatedBookId]);
  useEffect(() => () => { window.clearTimeout(showTimer.current); window.clearTimeout(hideTimer.current); }, []);
  useEffect(() => { hideTip(); setHovered(null); }, [focusShelfId, hideTip]);

  const onSelect = useCallback((shelfId: string, pointerType: string) => {
    if (pointerType === "touch") setTouch(true);
    onFocusShelf(shelfId);
  }, [onFocusShelf]);

  const onBookClick = useCallback((bookId: string, pointerType: string) => {
    if (pointerType === "touch") {
      setTouch(true);
      setTouchCardId(bookId);
    } else {
      onOpenBook(bookId);
    }
  }, [onOpenBook]);

  const bookSummary = (book: Book) => {
    const display = getBookDisplay(book, locale);
    const status = statusOf(book);
    const shelf = shelves.find((item) => item.id === book.shelfId);
    const place = shelf ? describePlace(book, shelf, focusSlots.get(book.id), locale, copy).sentence : copy.notShelved;
    return (
      <>
        <strong>{display.title}</strong>
        <p>{display.author} · {book.year}</p>
        <p>{classSystem.toUpperCase()} {classSystem === "ddc" ? book.ddc : book.kdc}</p>
        <p>{place}</p>
        <span className={`availability ${status.tone}`}><i />{status.label}</span>
      </>
    );
  };

  const tipContent = (() => {
    if (!tip) return null;
    if (tip.kind === "book") {
      const book = books.find((item) => item.id === tip.id);
      return book ? bookSummary(book) : null;
    }
    const shelf = shelves.find((item) => item.id === tip.id);
    if (!shelf) return null;
    const location = locations.find((item) => item.id === shelf.locationId);
    return (
      <>
        <strong>{getShelfDisplay(shelf, locale)}</strong>
        <p>{location ? getLocationDisplay(location, locale) : ""} · {floorLabel(shelf.floor, locale)}</p>
        <p>{fill(copy.shelfBookCount, { count: booksByShelf.get(shelf.id)?.length ?? 0 })}</p>
      </>
    );
  })();

  const touchBook = touchCardId ? books.find((book) => book.id === touchCardId) ?? null : null;
  const hint = focusShelf ? (touch ? copy.touchHint : copy.standingHint) : copy.overviewHint;

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">{copy.library3dEyebrow}</span><h1>{copy.library3dTitle}</h1><p>{copy.library3dDescription}</p></div>
      </div>

      {locatedBook && locatedShelf && locatedPlace && (
        <div className="located-banner" role="status">
          <MapPin />
          <div>
            <span className="eyebrow">{copy.locatedBook}</span>
            <strong>{getBookDisplay(locatedBook, locale).title}</strong>
            <p>{locatedPlace.sentence}</p>
            {statusOf(locatedBook).tone === "borrowed" && <small>{copy.onLoanNotOnShelf}</small>}
            {!locatedPlace.exact && <small>{fill(copy.approximatePosition, { bin: locatedBook.bin })}</small>}
          </div>
          <div className="banner-actions">
            <button className="secondary-button" onClick={() => onOpenBook(locatedBook.id)}><BookOpen />{copy.details}</button>
            <button className="secondary-button" onClick={onClearLocated}><X />{copy.clearMarker}</button>
          </div>
        </div>
      )}

      <section className="scene-card library3d-card">
        <div className="scene-toolbar library3d-toolbar">
          <nav className="scene-breadcrumb" aria-label={copy.library3d}>
            {focusShelf ? <button onClick={() => onFocusShelf(null)}>{copy.library3d}</button> : <strong>{copy.library3d}</strong>}
            <span aria-hidden="true">›</span>
            {focusShelf ? (
              <>
                <span>{focusLocation ? getLocationDisplay(focusLocation, locale) : ""} {floorLabel(focusShelf.floor, locale)}</span>
                <span aria-hidden="true">›</span>
                <strong aria-current="location">{getShelfDisplay(focusShelf, locale)}</strong>
              </>
            ) : <span aria-current="location">{copy.wholeLibrary}</span>}
          </nav>
          <div className="library3d-controls">
            <button aria-label={copy.shelfLeft} title={copy.shelfLeft} disabled={!leftShelf} onClick={() => leftShelf && onFocusShelf(leftShelf.id)}><ChevronLeft /></button>
            <select aria-label={copy.chooseShelf} value={focusShelfId ?? ""} onChange={(event) => onFocusShelf(event.target.value || null)}>
              <option value="">{copy.wholeLibrary}</option>
              {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{getShelfDisplay(shelf, locale)}</option>)}
            </select>
            <button aria-label={copy.shelfRight} title={copy.shelfRight} disabled={!rightShelf} onClick={() => rightShelf && onFocusShelf(rightShelf.id)}><ChevronRight /></button>
          </div>
        </div>
        <div
          className="scene-wrap library3d-wrap"
          ref={wrap}
          onPointerLeave={() => { setHovered(null); hideTip(); }}
        >
          <ShelfScene
            shelves={shelves}
            books={books}
            locale={locale}
            selectedShelfId={focusShelfId}
            highlightedBookId={locatedBookId}
            onSelect={onSelect}
            followSelection
            viewRequest={viewRequest}
            hovered={hovered}
            onHover={onHover}
            onBookClick={onBookClick}
            absentBookIds={absentBookIds}
            fallback={<div className="scene-fallback">{copy.noWebgl}</div>}
          />
          {focusShelf && (
            <button className="overview-button" onClick={() => onFocusShelf(null)}><LayoutGrid />{copy.wholeLibrary}</button>
          )}
          <div ref={tooltip} className="scene-tooltip" hidden={!tipContent} aria-hidden="true">{tipContent}</div>
          {touchBook && (
            <div className="touch-card">
              <div>{bookSummary(touchBook)}</div>
              <div className="touch-card-actions">
                <button className="primary-button" onClick={() => { setTouchCardId(null); onOpenBook(touchBook.id); }}>{copy.details}</button>
                <button className="icon-button" aria-label={copy.closeCard} onClick={() => setTouchCardId(null)}><X /></button>
              </div>
            </div>
          )}
          {!touchBook && <div className="scene-hint">{hint}</div>}
        </div>
        {focusShelf && focusTotal > capacity && (
          <div className="shelf-overflow">
            <span>{fill(copy.showingOfTotal, { shown: capacity, total: focusTotal })}</span>
            <button className="text-button" onClick={() => onShowShelfInList(focusShelf.id)}>{copy.seeAllInList}</button>
          </div>
        )}
      </section>
      <p className="sr-only" aria-live="polite">{focusShelf ? fill(copy.nowInFront, { shelf: getShelfDisplay(focusShelf, locale) }) : ""}</p>
    </>
  );
}

"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JourneyStep } from "@/lib/journey";
import { JOURNEY_COPY } from "@/lib/journey";
import { fill, type Locale } from "@/lib/i18n";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 14;
const EDGE = 16;
/** Below this width the card docks to the bottom of the screen instead of following the target. */
const DOCK_WIDTH = 640;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const nextFrame = (callback: () => void) =>
  typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(callback) : window.setTimeout(callback, 16);
const cancelFrame = (id: number) =>
  typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame(id) : window.clearTimeout(id);

/** The on-screen box of a target, or null when it is missing, hidden or off screen (a closed mobile menu). */
function visibleRect(element: HTMLElement): Rect | null {
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  if (box.right <= 0 || box.left >= window.innerWidth || box.bottom <= 0 || box.top >= window.innerHeight * 3) return null;
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * Dims the page, cuts a highlight around the step's target and shows the explanation card beside it.
 * The dimming does not take clicks, so the viewer can try the highlighted feature while reading.
 */
export default function JourneyTour({ step, index, total, locale, action, note, onBack, onNext, onClose }: {
  step: JourneyStep;
  index: number;
  total: number;
  locale: Locale;
  action?: { label: string; run: () => void } | null;
  note?: string | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const copy = JOURNEY_COPY[locale];
  const text = copy.steps[step.id];
  const [rect, setRect] = useState<Rect | null>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const last = index + 1 >= total;
  const actionLabel = action?.label;

  // Find the target (it may render a few frames after the tab changes), scroll it into view and track it.
  useEffect(() => {
    let element: HTMLElement | null = null;
    let cancelled = false;
    let findFrame = 0;
    let measureFrame = 0;
    let tries = 0;
    let queued = false;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      queued = false;
      if (!cancelled) setRect(element ? visibleRect(element) : null);
    };
    const onChange = () => {
      if (queued || cancelled) return;
      queued = true;
      measureFrame = nextFrame(measure);
    };
    const find = () => {
      if (cancelled) return;
      element = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      if (!element && step.target && tries++ < 40) {
        findFrame = nextFrame(find);
        return;
      }
      const box = element ? visibleRect(element) : null;
      if (element && box) {
        // A docked card covers the lower part of a phone screen, so lift the target to the top there.
        const top = box.height > window.innerHeight * 0.6 || window.innerWidth < DOCK_WIDTH;
        element.scrollIntoView?.({ block: top ? "start" : "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
      // The target can change size while the step is open, for example when a search narrows the book list.
      if (element && typeof ResizeObserver === "function") {
        observer = new ResizeObserver(onChange);
        observer.observe(element);
      }
      measure();
    };

    findFrame = nextFrame(() => {
      setRect(null);
      find();
    });
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelled = true;
      cancelFrame(findFrame);
      cancelFrame(measureFrame);
      observer?.disconnect();
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [step.id, step.target]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Place the card below the target, or above it, or docked at the bottom when neither fits.
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const style = element.style;
    style.top = style.left = style.right = style.bottom = "";
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!rect) {
      element.dataset.placement = "center";
      return;
    }
    if (width < DOCK_WIDTH) {
      element.dataset.placement = "dock";
      return;
    }
    const cardHeight = element.offsetHeight;
    const cardWidth = element.offsetWidth;
    const below = rect.top + rect.height + PAD + GAP;
    const above = rect.top - PAD - GAP - cardHeight;
    let top: number;
    if (below + cardHeight <= height - EDGE) top = below;
    else if (above >= EDGE + 72 && above + cardHeight <= height - EDGE) top = above;
    else {
      element.dataset.placement = "corner";
      return;
    }
    element.dataset.placement = "anchored";
    style.top = `${top}px`;
    style.left = `${Math.min(Math.max(rect.left, EDGE), width - cardWidth - EDGE)}px`;
  }, [rect, step.id, locale, note, actionLabel]);

  const spotlight = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  return (
    <div className="journey-layer">
      {spotlight ? <div className="journey-spotlight" style={spotlight} aria-hidden="true" /> : <div className="journey-dim" aria-hidden="true" />}
      <section
        ref={card}
        className="journey-card"
        role="dialog"
        aria-modal="false"
        aria-label={copy.tourLabel}
        aria-describedby={`journey-body-${step.id}`}
        data-placement="center"
        onKeyDown={(event) => {
          const field = event.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName);
          if (field) return;
          if (event.key === "ArrowRight") onNext();
          else if (event.key === "ArrowLeft" && index > 0) onBack();
        }}
      >
        <header>
          <span className="eyebrow">{copy.chapters[step.chapter]}</span>
          <span className="journey-progress">{fill(copy.progress, { current: index + 1, total })}</span>
          <button className="icon-button" aria-label={copy.close} onClick={onClose}><X /></button>
        </header>
        <h2 ref={heading} tabIndex={-1}>{text.title}</h2>
        <p id={`journey-body-${step.id}`}>{text.body}</p>
        {text.tips.length > 0 && <ul className="journey-tips">{text.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
        {note && <p className="journey-note">{note}</p>}
        <div className="journey-bar" aria-hidden="true"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <footer>
          {action ? <button className="secondary-button" onClick={action.run}>{action.label}</button> : <span />}
          <div>
            {index > 0 && <button className="secondary-button" onClick={onBack}><ChevronLeft />{copy.back}</button>}
            <button className="primary-button" onClick={onNext}>{last ? copy.finish : copy.next}{!last && <ChevronRight />}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

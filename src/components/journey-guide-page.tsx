"use client";

import { Bell, BookOpen, Bot, Box, Compass, Languages, Layers3, Map as MapIcon, Search, ShieldCheck, UserRound, Users, type LucideIcon } from "lucide-react";
import React from "react";
import type { Actor, LibraryMode } from "@/lib/domain";
import type { Locale } from "@/lib/i18n";
import { JOURNEY_CHAPTERS, JOURNEY_COPY, JOURNEY_STEPS, type JourneyStepId } from "@/lib/journey";

const STEP_ICONS: Partial<Record<JourneyStepId, LucideIcon>> = {
  search: Search,
  scene: MapIcon,
  classes: Layers3,
  books: BookOpen,
  library3d: Box,
  "my-loans": BookOpen,
  notifications: Bell,
  language: Languages,
  identity: UserRound,
  "admin-queue": ShieldCheck,
  "admin-users": Users,
  "admin-catalog": Layers3,
  adapt: Bot,
};

/** The feature manual: every journey step as a short how-to, each with a button that shows it on screen. */
export default function JourneyGuidePage({ locale, role, mode, onStart }: {
  locale: Locale;
  role: Actor["role"];
  mode: LibraryMode;
  onStart: (stepId?: JourneyStepId) => void;
}) {
  const copy = JOURNEY_COPY[locale];
  const chapters = JOURNEY_CHAPTERS.map((chapter) => ({
    chapter,
    steps: JOURNEY_STEPS.filter((step) => step.chapter === chapter && step.feature && (!step.demoOnly || mode === "demo")),
  })).filter((group) => group.steps.length > 0);

  return (
    <div className="journey-guide">
      <section className="journey-guide-hero" aria-labelledby="journey-guide-title">
        <span className="eyebrow">{copy.guideEyebrow}</span>
        <h1 id="journey-guide-title">{copy.guideTitle}</h1>
        <p>{copy.guideLead}</p>
        <button className="primary-button" onClick={() => onStart()}><Compass />{copy.guideStart}</button>
      </section>

      <ol className="journey-chapters">
        {chapters.map(({ chapter, steps }, chapterIndex) => (
          <li key={chapter} className="journey-chapter">
            <h2><span>{String(chapterIndex + 1).padStart(2, "0")}</span>{copy.chapters[chapter]}</h2>
            <ul>
              {steps.map((step) => {
                const Icon = STEP_ICONS[step.id] ?? Compass;
                const text = copy.steps[step.id];
                const locked = Boolean(step.adminOnly) && role !== "admin";
                const blocked = locked && mode !== "demo";
                return (
                  <li key={step.id} className="journey-feature">
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{text.title}{step.adminOnly && <span className="journey-badge">{copy.adminBadge}</span>}</h3>
                      <p>{text.body}</p>
                      {text.tips.length > 0 && (
                        <ul className="journey-tips" aria-label={copy.tipsLabel}>{text.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                      )}
                      <div className="journey-feature-actions">
                        <button className="secondary-button" disabled={blocked} aria-label={`${copy.showMe}: ${text.title}`} onClick={() => onStart(step.id)}>{copy.showMe}</button>
                        {locked && <small>{blocked ? copy.adminLockedNote : copy.adminSwitchNote}</small>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

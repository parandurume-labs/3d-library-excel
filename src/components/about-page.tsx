import { Accessibility, Award, Bot, Box, ExternalLink, Github, Globe, HeartHandshake, Share2, Sprout, Users } from "lucide-react";
import React from "react";
import { ABOUT_COPY, LICENSE_URL, MVP_PROFILE_URL, REPO_URL, type Locale } from "@/lib/i18n";

const PILLAR_ICONS = [Share2, Users, Bot, Sprout];
const IMPACT_ICONS = [HeartHandshake, Globe, Accessibility, Box];

export default function AboutPage({ locale, onOpen3d, open3dLabel }: { locale: Locale; onOpen3d: () => void; open3dLabel: string }) {
  const about = ABOUT_COPY[locale];
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <span className="eyebrow">{about.eyebrow}</span>
        <h1 id="about-title">{about.title}</h1>
        <p className="about-lead">{about.lead}</p>
        <figure className="about-motto">
          <blockquote>{about.motto}</blockquote>
          <figcaption>{about.mottoNote}</figcaption>
        </figure>
        <p className="about-byline">
          <span className="mvp-badge"><Award />Microsoft MVP</span>
          <span>{about.mvpCategory}</span>
          <span aria-hidden="true">·</span>
          <span>{about.byline}</span>
          <a href={MVP_PROFILE_URL} target="_blank" rel="noreferrer">{about.mvpProfile}<ExternalLink aria-hidden="true" /><span className="sr-only">{about.newTab}</span></a>
        </p>
      </section>

      <ol className="about-pillars">
        {about.pillars.map((pillar, index) => {
          const Icon = PILLAR_ICONS[index];
          return (
            <li key={pillar.title}>
              <Icon aria-hidden="true" />
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </li>
          );
        })}
      </ol>

      <section className="about-guide" aria-labelledby="about-guide-title" data-tour="about-guide">
        <div>
          <span className="eyebrow">{about.guideEyebrow}</span>
          <h2 id="about-guide-title">{about.guideTitle}</h2>
          <p>{about.guideBody}</p>
          <div className="about-actions">
            <a className="primary-button" href={about.guideUrl} target="_blank" rel="noreferrer"><Bot />{about.readGuide}<ExternalLink aria-hidden="true" /><span className="sr-only">{about.newTab}</span></a>
            <a className="secondary-button" href={REPO_URL} target="_blank" rel="noreferrer"><Github />{about.viewSource}<span className="sr-only">{about.newTab}</span></a>
            <button type="button" className="secondary-button" onClick={onOpen3d}><Box />{open3dLabel}</button>
          </div>
        </div>
        <ol className="about-steps">
          {about.guideSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="about-section" aria-labelledby="about-impact-title">
        <span className="eyebrow">{about.impactEyebrow}</span>
        <h2 id="about-impact-title">{about.impactTitle}</h2>
        <ul className="about-grid">
          {about.impacts.map((impact, index) => {
            const Icon = IMPACT_ICONS[index];
            return <li key={impact.title}><Icon aria-hidden="true" /><strong>{impact.title}</strong><p>{impact.body}</p></li>;
          })}
        </ul>
      </section>

      <section className="about-section" aria-labelledby="about-stack-title">
        <span className="eyebrow">{about.stackEyebrow}</span>
        <h2 id="about-stack-title">{about.stackTitle}</h2>
        <ul className="about-stack">
          {about.stack.map((item) => <li key={item.name}><strong>{item.name}</strong><span>{item.role}</span></li>)}
        </ul>
      </section>

      <p className="about-license"><a href={LICENSE_URL} target="_blank" rel="noreferrer">{about.license}<span className="sr-only">{about.newTab}</span></a> · {about.byline} · Microsoft MVP</p>
    </div>
  );
}

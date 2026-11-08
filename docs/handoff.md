# Handoff status

## Current status

Branch `feat/journey-guide` adds Journey Tour (Korean: 이용방법) for first-time users and bumps the version to 1.1.0:

- A first-visit prompt ("New here?") on the home screen that offers the tour once per browser (`localStorage` key `durume-journey-v1`).
- A guided tour (`src/components/journey-tour.tsx`) that dims the page, highlights one feature at a time through `data-tour` attributes, switches screens by itself, and closes with Esc. In the demo, a member can switch to the admin view from the role step and the tour continues into the admin desk.
- A feature manual on the new **Journey Tour** sidebar page (`src/components/journey-guide-page.tsx`), with a "Show me" button for every feature.
- Steps and English/Korean copy live in `src/lib/journey.ts`.
- README (both languages) and the AI adaptation guide (both languages) describe the journey and tell adapters to keep the steps and `data-tour` attributes in sync.

Details, decisions and the review record: [`docs/work/2026-11-08-journey-guide.ko.md`](work/2026-11-08-journey-guide.ko.md).

## Validation

Run on the code before the rename to Journey Tour and 1.1.0; the rename re-run is listed last.


- `npx vitest run`: 8 files, 51 tests passed.
- `npx tsc --noEmit`: passed.
- `npx eslint .`: passed.
- `npm run build`: passed.
- Independent review: nothing blocking; all eight non-blocking findings and the Korean wording suggestions were fixed (one rebutted). See the work record.
- Browser check (gstack browse, Chromium, demo mode): 1440×900 English tour from the first-visit prompt through the 3D library, the admin switch and the admin desk; 1440×900 Korean feature manual page; 390×844 Korean tour with the card docked at the bottom and no horizontal scroll.
- After the rename (Journey Tour / 이용방법, About & guide/소개와 가이드 → About Project/프로젝트 안내) and the 1.1.0 bump: vitest 51 passed, tsc and eslint passed, Korean scan 0 candidates, and `next build` passed on a copy of the working tree (built away from the running dev server's `.next`).

## Next owner

Review the diff and the work record, then commit, push and open a pull request if accepted.

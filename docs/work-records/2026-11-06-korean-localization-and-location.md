# Korean localization and 3D location highlight

## Architect

- Scope: localize the existing React UI into English/Korean, improve Korean demo metadata, and keep the book drawer open while locating a book in the 3D scene.
- Preserve the Excel workbook as source of truth and keep older workbook schemas readable.
- Avoid unrelated catalog, authentication, or persistence changes.

## Investigate

- The repository had no CLAUDE.md, AGENTS.md, Copilot instructions, prior docs/work records, or uncommitted changes.
- UI strings and synthetic titles were English-only and book display metadata came directly from `title`/`author`.
- The detail location block was informational and did not connect to shelf/book highlighting.
- The Excel generator used the same state as the local demo; Graph/Excel reads table headers dynamically and writes table rows.

## Implement

- Added an English/Korean language switcher, comprehensive Korean UI copy, Korean workflow statuses, localized dates, and `html[lang]` updates.
- Added natural Korean title/author metadata to demo data and the generated `Books` table as optional `titleKo`/`authorKo` fields.
- Kept legacy workbook compatibility by treating localized columns as optional and writing according to each table's actual header order.
- Added translated metadata fields to the admin book editor so localized values can be persisted to Excel.
- Made the detail location a button that selects the book's shelf and highlights its exact book mesh without closing the drawer.
- Regenerated `artifacts/3d-library-demo.xlsx` from the updated source state.
- Independent review fix: Korean metadata uses an explicit nullable contract. Clearing an editor field serializes `null`, transition validation retains the clear operation, and Excel serializes it as an empty cell instead of omitting the value and preserving the previous text.
- Independent review fix: Excel reads retain each table row's raw header/value map alongside the Zod-validated state. Commit updates merge validated changes over that raw row before serializing the full actual header order, preserving custom/unknown column cells.

## Review evidence

- Pre-fix: `undefined` values were omitted by JSON, so clearing localized metadata could not replace an existing workbook string; Zod parsing stripped custom columns and full-row PATCH wrote blanks for them.
- Post-fix diff: `titleKo`/`authorKo` are nullable and the form sends `null`; `ExcelGraphRepository.readSnapshot` returns raw rows, and changed-row PATCH merges raw custom values with the updated domain row.
- Regression tests: transition clearing contract, admin editor POST payload with explicit `null`, and Excel custom-column preservation during a row update.
- `.gstack/` remained unrelated and excluded from the change set.

## Verify

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings or errors.
- `npm test` passed: 4 files, 24 tests (including nullable-clear and unknown-column regressions).
- `npm run build` passed; `/` was statically generated and all API/auth routes compiled.
- `git diff --check` passed.
- Regenerated workbook inspection confirmed `Books` headers include `titleKo` and `authorKo`, with first-row values `사라진 지도의 기록` and `김하늘`.

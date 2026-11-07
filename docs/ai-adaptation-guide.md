# Guide to adapting this project with AI

**English** | [한국어](ai-adaptation-guide.ko.md)

> This document is written **for people and AI to read together**. When you ask an AI to change
> this repository, hand it this document as well. The AI reads the order of changes and the rules
> to keep; the person learns how to check what the AI did.

It used to be that if you needed a business tool, you had to build it from scratch. Today you can
adapt an existing example to your own work together with AI. Using a library as its example, this
project is a starting point that covers **multilingual UI, 3D visualization, logistics and
inventory flow, and members and roles**. The goal is to help the many people who manage small or
medium-sized business data get useful results by combining a web app, Excel and Microsoft Graph,
before they take on complex infrastructure.

## First decide what to change

Do not just swap the library vocabulary. Define each of these in one sentence:

1. What you manage: books, equipment, supplies, spaces, vehicles or documents?
2. Core states: e.g. `received`, `ready`, `checked_out`, `due`, `returned`, `outbound`
3. Roles: viewer, member/requester, administrator/approver
4. Data volume and number of concurrent users
5. History you must keep, and business rules
6. Whether Excel stays the source of truth, or moves to another store as you grow

If the domain is small and your collaborators need to check the data in Excel, this project's
single-workbook structure fits well. If many users write at the same time or you need strict
transactions, keep the `LibraryRepository` boundary and ask the AI to swap the adapter for a
database.

## Order of changes by file

| Step | File / area | Work to give the AI |
| --- | --- | --- |
| 1 | `src/lib/domain.ts` | Entities, roles, state transitions, Zod schema changes |
| 2 | `src/lib/transitions.ts` | Business rules, approval/return/outbound transitions and permission checks |
| 3 | `src/lib/demo-data.ts`, `scripts/generate-workbook.ts` | New sample data and Excel table generation |
| 4 | `src/lib/repositories/` | Keep or extend the local/Excel adapters against the existing contract |
| 5 | `src/app/api/` | Validation of new actions and server-side RBAC |
| 6 | `src/components/`, `src/lib/i18n.ts` | List, detail and dashboard UI, and multilingual strings |
| 7 | `*.test.ts`, `*.test.tsx` | State transitions, permissions, menu visibility, UI regression tests |

It is safest to change `domain.ts` and the workbook generator together first, pin the contract with
tests, and only then change the UI. If you ask for several layers at once, it becomes hard to find
the cause when something breaks.

## Rules for using Excel and Microsoft Graph as the data source

- Table and column names are a contract. Review `schemaVersion` with every meaningful change.
- Every row has an `id` that never changes or repeats, and a `version` for optimistic concurrency.
- Never send values produced by the UI or by AI straight to Graph; validate them again with Zod on
  the server.
- Hiding menus in the browser is not enough to enforce role-based permissions. The API checks
  permissions again for every action.
- Columns that users added to an existing workbook must survive reads and writes.
- Never put secrets, access tokens, Graph IDs or real member data into prompts or source code.
- Excel is good for viewing and editing together and suits small to medium scale, but it does not
  provide database-level transactions.

For Graph mode setup and the workbook table contract, follow the steps in the [README](../README.md).

## Prompts you can hand to an AI

### 1. Change the domain

```text
Turn this repository from a library app into an internal equipment loan app.
First review only src/lib/domain.ts and the Workbook table contract, and propose a change plan.
Map the existing entities, such as Books→Assets and Loans→Checkouts,
and propose received, ready, checked_out, due, returned and outbound states.
Before changing any file, explain how you will keep id/version, relations, server RBAC and Excel compatibility.
```

### 2. Add a small business rule

```text
An asset on loan cannot be deleted, and a member cannot change the overdue state without approval.
First add a failing test to src/lib/transitions.test.ts, then implement only enough to make it pass.
Do not touch the user's uncommitted changes or the logic that preserves columns users added in Excel.
```

### 3. Add multilingual UI

```text
Add only the new asset types and states in Korean and English.
Follow the key structure of src/lib/i18n.ts and do not hard-code strings.
Update the existing UI tests and verify the Korean switch, html lang and admin menu visibility.
```

### 4. Adapt the 3D view to other assets

```text
Change the shelf visualization to warehouse rack positions.
Separate the domain fields and the layout calculation first, and keep showing
accessible list information instead of 3D when there is no real data.
```

## Breaking AI work into small pieces

A good unit of work is one where you can check "contract → implementation → tests → explanation"
in one pass.

1. Read `git status` and the diff, and decide how to keep the user's existing changes.
2. Settle the states, roles and table contract of one feature first.
3. Add a failing unit or UI test.
4. Change only what is needed, in the order domain, server, UI.
5. Run `npm run typecheck`, `npm run lint`, the relevant `npm test`, and `npm run build`.
6. If the workbook schema changed, check the newly generated file and its table names and columns.

It helps to repeat these rules to the AI at every step:

> Do not overwrite unrelated changes in the working tree; change only the relevant files. Put
> security and permission checks on the server, not only in the browser, and do not hard-code real
> data or secrets. After the change, report the test and build commands you ran, their results,
> and anything that is still uncertain.

## Checklist: is the definition complete?

- [ ] Every entity has a unique `id` and a `version`.
- [ ] Every state transition has its allowed roles and required previous state.
- [ ] The admin menu and API permissions both follow roles, and the member view has no admin links.
- [ ] The Excel tables and the demo data use the same contract.
- [ ] Optional columns and user-added columns in existing workbooks are preserved.
- [ ] The multilingual UI has no missing strings and no hard-coded English.
- [ ] If 3D or visualization fails, people can keep working with lists and status information.
- [ ] There are tests for intake/registration, loan/checkout, due/overdue and return/outbound.
- [ ] Checks that work without real Graph credentials are separated from checks that need production credentials.

## Where this example fits well

- Work with few users where viewing and editing together in Excel matters
- Flows with clearly separated states such as registration, request, approval, loan, return, due date and location
- Teams that want to narrow requirements back and forth with AI and verify screens and rules
- Projects that want to prove a real workflow before adopting PostgreSQL or an ERP

When usage and concurrency grow, keep the UI and domain rules and swap the repository adapter for a
transactional store. Excel is not a default you must keep forever; it is **a data source that lets
you start cheaply and confirm real use**.

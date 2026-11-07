# Durume 3D Library for Excel

**English** | [한국어](README.ko.md)

> **A small first step toward a world where the benefits of technology reach everyone**
>
> An open-source example built by a Microsoft MVP and shared with everyone.
> You no longer have to build everything by hand. To help you adapt this app to your own work
> with AI, the repository ships a guide for people and a **guide written for AI**.

## Why we built this

This project was built by LEE Inhee, CEO of Parandurume Inc. and a
[Microsoft MVP](https://mvp.microsoft.com/en-US/MVP/profile/b4ef6855-0cce-ed11-a7c6-000d3a5603d3)
(Microsoft Foundry). The headline of that MVP profile reads:

> *World should enjoy the benefits of exponential technologies with ease.*

As a Microsoft MVP, my goal is twofold. First, the benefits of technology should not stay with a
few people but spread widely to many more. Second, technology should help build an inclusive world
where no one is left behind. Sharing what we learn is part of being an MVP, so both this app and
the way it was made are open to everyone.

**What AI becomes depends on who manages it and how it is used.** In a few hands it widens the
gap; in many hands it widens opportunity. Schools, community libraries, small nonprofits and local
businesses should be able to build the tools they need with AI, even without a large company or a
professional development team behind them.

This repository turns that belief into something you can hold. We hope it is a small start toward
an abundant world where more people enjoy more opportunities and more of the benefits.

## From building by hand to adapting with AI

It used to be that getting a useful business tool meant building it from scratch or buying an
expensive product. Today you can talk with AI and adapt an existing example to your own work. But
if you simply tell an AI "build it for me", it can easily touch the wrong places or miss a
security decision.

That is why this repository includes a **guide written for AI**, alongside the documentation for
people.

- [Guide to adapting this project with AI](docs/ai-adaptation-guide.md): prompts you can
  hand to an AI as they are, the order in which to change files, how to check the result, and the
  security decisions you should never leave to AI.
- [Work records](docs/work/) (Korean): how features were added with AI through design,
  investigation, implementation and independent review. Another person or another AI can pick up
  the work from there.

Even without deep coding knowledge, you can hand this guide to an AI and turn the library app, step
by step, into an equipment loan, teaching materials or room booking app. The same content is in the
app under **About & guide**.

## Social impact

| What | How |
| --- | --- |
| Low barrier | No separate database to run: one Excel file you already use is the data source. Schools, nonprofits and small teams that cannot adopt a large system can start right away. |
| Open code and social gratitude | Released under the [GM-Social License v2.0](LICENSE). Anyone may use, study, change and share it. If you deploy it in a production environment, you must perform "social gratitude" within 90 days of first deployment: publicly post thanks saying the project started in Gwangmyeong, Gyeonggi-do, and share places or stories of Gwangmyeong on public channels (the posting methods and hashtags are in the license). Educational and learning use, public-benefit use by nonprofits, and disaster or emergency use are exempt. See Article 3.2 of the license for the full terms. |
| A screen for everyone | Korean and English. Browsers that cannot draw 3D can still find books through the shelf list and written location, and screen readers are told when the view moves to a shelf. |
| Beyond libraries | The library is just an example. Rename the tables and words to run equipment loans, supplies or room booking. |
| Material for learning together | The guide and work records show how to work with AI, so anyone can follow along and adapt it. |

## Tech stack

| Area | Technology | Role |
| --- | --- | --- |
| Web app | Next.js 15 (App Router), React 19, TypeScript | UI and server API |
| 3D | Three.js, React Three Fiber, drei | 3D shelves and camera moves |
| Data | Microsoft Excel, OneDrive | One workbook as the data source |
| Integration | Microsoft Graph | Reads and writes Excel tables |
| Sign-in and access | Microsoft Entra ID, NextAuth | Microsoft account sign-in and role-based access |
| Validation | Zod | Re-validates data on the server |
| Testing | Vitest, Testing Library, jsdom | Unit and UI tests |
| Working with AI | [Guide for AI](docs/ai-adaptation-guide.md), [work records](docs/work/) | How to hand work to AI and check the result |

## A small, practical data management app built with AI

This repository is **not a library-only product**. It is an application example anyone can take
and fit to their own work. The library UI, built with Next.js and Three.js, also shows features that
business apps commonly need:

- **Multilingual**: Korean and English UI and data display
- **3D visualization**: browse space, location and asset status at a glance
- **Logistics and inventory flow**: registration and intake, loan and checkout, reservation, due
  dates and overdue, return and outbound processing
- **Members and roles**: different screens by role, approval steps, and separation of personal
  status from operations work

Above all, this project is a working example that shows **you can build a small or medium-sized
data management app by talking with AI**, without starting from a large database. It uses **one
Excel workbook in OneDrive as the data source** and connects authenticated reads and writes through
Microsoft Graph. Change the domain names and Excel tables, and it fits tool, equipment and room
booking, internal item lending, teaching material management and more.

In Graph/Excel mode, one Excel workbook is the source of truth; nothing is also written to a
SharePoint list or a local DB. Without credentials, the local demo mode uses synthetic data only and
lets you walk through every user flow.

## Reusable features in this example

- 3D shelf rotation and zoom, shelf and location selection, search and classification filters
- 3D library page: walk up to a shelf, return to the whole view, hover a book to see its details
- Korean/English UI switch and per-language data display
- DDC/KDC display switch, and finding a book's position on the 3D shelf while the detail panel stays open
- Registration (intake), loan requests, reservations, return requests, due date and overdue display with notifications
- Members' personal loans and reservations; administrators' approval and return (outbound/collection) processing
- Book/asset create, edit, delete and placement; member and role management
- Excel table reads and writes through Microsoft Entra delegated OAuth and Microsoft Graph
- Optimistic concurrency checks with stable IDs and versions; server-side role-based access control
- A synthetic 520-book Excel workbook to use as a checkpoint when you grow the small domain model with AI

## Quick start: local demo without credentials

You need Node.js 20 or later and npm.

```powershell
npm install
Copy-Item .env.example .env.local
# Check DATA_MODE=demo in .env.local
npm run dev
```

Open `http://localhost:3000`. You should see `LOCAL DEMO DATA` at the top of the screen
(`로컬 데모 데이터` in the Korean UI).

- Use the user picker at the top to switch between `Member view` and `Admin view`.
- Default member: stable ID `user-demo-member`, name `Demo Member`
- Default administrator: stable ID `user-demo-admin`, name `Demo Librarian`
- The admin menu and `Admin desk` appear only in `Admin view`. The member view does not even show the link.
- Demo email addresses are `*.example.invalid` addresses, not real accounts.
- `About & guide` at the bottom of the sidebar shows why the project exists, the tech stack and the guide for AI.

Demo changes live only in the Node.js process memory, so restarting the server resets them. Do not
use the demo for real user or production data.

## Local demo and Graph/Excel mode

| Item | Local demo | Graph/Excel |
| --- | --- | --- |
| Server setting | `DATA_MODE=demo` | `DATA_MODE=graph` |
| Data source | Process memory in `src/lib/demo-data.ts` | Excel tables in the configured OneDrive workbook |
| Sign-in | Demo user picker at the top | Microsoft sign-in (`/api/auth/signin`) |
| Role | Demo member/admin choice | `role` in the workbook `Users` table |
| Persistence | Reset when the server restarts | Saved in the OneDrive workbook |
| On error | Local demo only | Returns the error; never switches to the demo on its own |

`NEXT_PUBLIC_DATA_MODE` is a helper value for display only. Permissions and the data source are
decided by the server's `DATA_MODE`.

## Running Graph/Excel mode on OneDrive

The table names and environment variable names below match the code.

### 1. Create the workbook and upload it to OneDrive

```powershell
npm run generate:workbook
```

By default this creates [`artifacts/3d-library-demo.xlsx`](artifacts/3d-library-demo.xlsx) with 520
synthetic books. The `titleKo`/`authorKo` columns in the `Books` table hold the title and author
shown in the Korean UI, and are stored in the workbook next to the original `title`/`author`.
Upload this file to the OneDrive of the user who will sign in.

These two columns are optional so that older workbooks stay compatible. Without them the Korean UI
shows the English title and author; with them, reads and writes follow the actual column order of
the table and keep the translated values.

Recommended layout:

```text
OneDrive root
└── 3d-library
    └── 3d-library-demo.xlsx
```

Once you have confirmed the file opens in Excel or OneDrive, do not rename it or move its folder.
On first run the file must **exist as a real file** in OneDrive, and the signing-in user must have
read and write access to it.

> The app does not take a file path as an environment variable. Instead it takes
> `GRAPH_DRIVE_ID` and `GRAPH_WORKBOOK_ITEM_ID`, which are used in Graph URLs.

### 2. Find the Graph drive and item IDs of the OneDrive file

1. Open [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer).
2. Sign in with the Microsoft account that uploaded the file, and consent to Microsoft Graph
   delegated permissions that can access that account's OneDrive.
3. If the file is at the OneDrive root, send this `GET` request:

   ```text
   https://graph.microsoft.com/v1.0/me/drive/root:/3d-library-demo.xlsx
   ```

   If you followed the recommended layout above, request this instead:

   ```text
   https://graph.microsoft.com/v1.0/me/drive/root:/3d-library/3d-library-demo.xlsx
   ```

4. Read these values from the response:

   ```json
   {
     "id": "<file item ID to use as GRAPH_WORKBOOK_ITEM_ID>",
     "parentReference": {
       "driveId": "<drive ID to use as GRAPH_DRIVE_ID>"
     }
   }
   ```

5. If the path contains spaces or non-ASCII file names, URL-encode it following Graph URL rules.
   Once you have the identifiers, it is safest not to move or rename the file.

The `driveId` is the actual Drive identifier, and the file's `id` is the Excel workbook item
identifier. They are not a user ID, an Excel row number, or the `id` of a table row.

### 3. Register a Microsoft Entra app

1. In the Microsoft Entra admin center, choose **App registrations > New registration**.
2. Choose the supported account types to match the test users and the file owner.
   - Only organizational OneDrive accounts: single tenant in the current organization (recommended)
   - Multiple organizations or personal Microsoft accounts too: the option that covers both account types
3. Add the **Web** platform and register the exact redirect URI.

   Local development:

   ```text
   http://localhost:3000/api/auth/callback/azure-ad
   ```

   For deployment, add the same path on your real HTTPS address. For example:

   ```text
   https://library.example.com/api/auth/callback/azure-ad
   ```

4. Under **Certificates & secrets**, create a client secret and write down its **Value**.
   `AZURE_AD_CLIENT_SECRET` takes this Value, not the Secret ID.
5. Under **API permissions > Add a permission > Microsoft Graph > Delegated permissions**, add
   `Files.ReadWrite.All` and `User.Read`.
6. Sign-in also requests these scopes:

   ```text
   openid profile email offline_access Files.ReadWrite.All User.Read
   ```

`Files.ReadWrite.All` is a strong permission that lets the signed-in user's session read and write
the files that user can access. If your organization allows user consent, users can consent at
sign-in. If tenant policy or the `Files.ReadWrite.All` approval policy blocks user consent, a tenant
administrator must run **Grant admin consent**. The code in this repository does not handle tenant
consent for you.

### 4. Configure `.env.local`

This example uses `3d-library/3d-library-demo.xlsx` in OneDrive. Replace the IDs and the secret with
your real values.

```dotenv
DATA_MODE=graph
NEXT_PUBLIC_DATA_MODE=graph

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=use-a-long-random-value-of-at-least-32-characters

AZURE_AD_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_AD_CLIENT_SECRET=<Value of the Entra client secret>
# For a single-tenant app, use the Directory (tenant) ID.
AZURE_AD_TENANT_ID=11111111-1111-1111-1111-111111111111

# parentReference.driveId from the Graph GET response above
GRAPH_DRIVE_ID=b!example-drive-id
# id from the Graph GET response above
GRAPH_WORKBOOK_ITEM_ID=01EXAMPLEFILEITEM
```

All variables and their defaults are in [`.env.example`](.env.example).

- `DATA_MODE`: `demo` or `graph`. Any other value is treated as demo.
- `NEXT_PUBLIC_DATA_MODE`: `demo`/`graph` for display in the browser
- `NEXTAUTH_URL`: the app's external URL, used to build the OAuth callback address
- `NEXTAUTH_SECRET`: the secret that encrypts and signs NextAuth sessions
- `AZURE_AD_CLIENT_ID`: the Entra app's Application (client) ID
- `AZURE_AD_CLIENT_SECRET`: the **Value** of the Entra client secret
- `AZURE_AD_TENANT_ID`: the Directory (tenant) ID, or `common` depending on the supported account types
- `GRAPH_DRIVE_ID`: `parentReference.driveId` from the Graph item response
- `GRAPH_WORKBOOK_ITEM_ID`: the file `id` from the Graph item response

Do not commit secrets, access tokens or Graph IDs to source control. `.env.local` is in `.gitignore`.

### 5. Register the first Graph user

In Graph mode, only users registered in the workbook `Users` table can use the app. Before the
first sign-in, open the workbook in OneDrive and edit the `Users` table.

1. Add a row with the real email address that will sign in, or copy a demo row and give it a new
   stable `id`. For example:

   ```text
   id: user-actual-admin-001
   version: 1
   authId: admin
   displayName: Library Admin
   email: library.admin@example.org
   role: admin
   ```

2. Register at least one user with `role=admin`. If an operator also wants to see the member view,
   add a `role=member` row the same way.
3. The app compares `Users.authId` with the `sub` value of the sign-in token, and also compares
   `Users.email` case-insensitively. For the first setup, **entering the account's exact email is
   the simplest way**.
4. `id` must be unique within the table and must never change. You do not need to reuse the real
   Microsoft account ID as `id` to match `authId` or email.
5. Save your changes in Excel, start the dev server with `npm run dev`, and open
   `http://localhost:3000`.
6. Follow the Microsoft sign-in link on the page to sign in through `/api/auth/signin`. The actual
   callback path is `/api/auth/callback/azure-ad`.
7. After signing in, check loans, reservations and notifications in `My library`. The `Admin desk`
   menu appears only for users with `role=admin` in the workbook and never in the member view.
8. In Graph/Excel mode the server API checks `role` again, so a member who sends an admin request
   directly is blocked with HTTP 403.

## Commands

```powershell
# Install dependencies
npm install

# Generate the default 520-book workbook
npm run generate:workbook

# Example: generate a different workbook with 750 books
$env:DEMO_BOOK_COUNT=750
npm run generate:workbook -- artifacts/library-fixture.xlsx

# Prepare .env.local with demo/graph settings
Copy-Item .env.example .env.local

# Dev server
npm run dev
```

The workbook generator raises any request below 500 books to 500. Generated data contains only
invented titles and author names and reserved `example.invalid` email addresses; it does not copy
real bibliographic records.

## Editing in Excel and checking in the app

1. Open the configured workbook in Excel for the web from OneDrive.
2. For example, change `title` on a `book-...` row in the `Books` table to a test value and save.
   Do not touch `id` or `version`.
3. Refresh the app, and `/api/library` reads the workbook's 7 tables again. The changed title
   should appear in search.
4. In the admin view, change the title or shelf placement of another test book. The app updates the
   workbook row through `/api/actions` and Graph.
5. Refresh or reopen the Excel table in OneDrive and check that the same row's title, `shelfId` and
   `bin` changed and `version` went up.
6. Request a loan as a member, approve it in the admin view, and check that `Loans.status`,
   `approvedAt`, `dueAt` and `version` are reflected in the workbook.

When editing in the app and in Excel at the same time, do not keep the same row open for long and
edit it on both sides. The app checks conflicts with stable IDs and `version`, and returns HTTP 409
`CONFLICT` when the workbook version differs from the expected one.

## Workbook table contract

The file must contain Excel tables with the names below and exact headers.

| Table | Columns |
| --- | --- |
| `Books` | `id`, `version`, `title`, `author`, `year`, `ddc`, `kdc`, `classIndex`, `locationId`, `shelfId`, `bin`, `coverColor`, `demo` |
| `Shelves` | `id`, `version`, `name`, `locationId`, `zone`, `floor`, `capacity` |
| `Locations` | `id`, `version`, `name`, `floor`, `zone` |
| `Users` | `id`, `version`, `authId`, `displayName`, `email`, `role` |
| `Loans` | `id`, `version`, `bookId`, `userId`, `status`, `requestedAt`, `approvedAt`, `dueAt`, `returnedAt` |
| `Reservations` | `id`, `version`, `bookId`, `userId`, `status`, `createdAt` |
| `Settings` | `id`, `version`, `key`, `value` |

Rules:

- Relations between tables always use `id`; Excel row numbers are used only inside the implementation.
- Each table's `id` must never change and must not repeat.
- `version` is an integer of 0 or more that goes up with every meaningful change.
- Dates are ISO 8601 UTC strings.
- `Settings` must have a row with `key=schemaVersion` and `value=1`.
- Loan statuses: `requested`, `approved`, `overdue`, `return_requested`, `returned`, `rejected`
- Reservation statuses: `waiting`, `ready`, `fulfilled`, `cancelled`
- Roles: `member`, `admin`
- Do not rename tables, sheets or headers, and do not store new relations as row numbers.

## Common errors

| Symptom / API code | Cause | Fix |
| --- | --- | --- |
| Graph `404`, app `GRAPH_ERROR` | `GRAPH_DRIVE_ID`/`GRAPH_WORKBOOK_ITEM_ID` point to another file, or the file was deleted or moved | Send the Graph GET request again, update `driveId` and `id`, and restart the server |
| Signed-in user not in `Users`: HTTP 403 `FORBIDDEN` | `Users.authId` or `email` does not match the real signed-in user | Add the exact email to the workbook `Users` table and set `role` |
| Graph HTTP 403, app `GRAPH_ERROR` | Missing delegated permission, file write access or tenant consent | Check `Files.ReadWrite.All`, `User.Read` and consent status in Entra, and check OneDrive file access |
| HTTP 401 `AUTH_REQUIRED` | No Microsoft sign-in session or Graph access token | Sign in again at `/api/auth/signin` |
| HTTP 401 `AUTH_EXPIRED` | Graph access token or session expired | Sign out and sign in again; also check that the Entra client secret has not expired |
| HTTP 422 `SCHEMA_ERROR` | Missing required table or header, wrong type or relation, `schemaVersion` mismatch | Restore tables and columns from a freshly generated workbook and check `Settings.schemaVersion=1` |
| Workbook or table errors shown as `GRAPH_ERROR` | The workbook is not `.xlsx`, or Graph does not recognize the Excel tables | Check the file format and the 7 table names, such as `Books`, in Excel |
| HTTP 409 `CONFLICT` | Another user changed the same row first, so `version` differs | Refresh the app and try again; when editing by hand, never lower `version` |
| HTTP 409 `INVALID_STATE` | Book already on loan, duplicate request, invalid state transition or shelf/zone combination | Check the current state of the book, loan or reservation and run only a valid next action |

Even when Graph authentication expires or the workbook fails to load, the app never switches to
demo mode on its own. This keeps you from mistaking changes saved only to demo data for changes
saved to the production file.

## What you can verify without real OneDrive credentials

Without credentials you can verify:

- The local demo UI, 3D shelves and the 3D library page, search, DDC/KDC switching
- Member loan, reservation and return requests; admin approval and return processing
- Server RBAC, duplicate prevention, state transitions, demo data conflict handling
- Workbook generation with 500+ books; Excel table name, column and relation validation
- Graph adapter auth expiry, schema, workbook session and version conflict paths (mock tests)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

The following need a real OneDrive workbook and Entra account, and were **not verified** in the
environment where this README was written:

- Real Microsoft sign-in and tenant consent
- Graph drive/item ID access to a specific OneDrive file
- Persistent reads and writes on a real workbook table
- Matching a user's real email or `sub` against `Users` rows
- Organizational Conditional Access, consent policies, MFA and Graph throttling

## Verification commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover synthetic workbook integrity, 500+ books, stable IDs and relations, state
transitions, duplicate prevention, RBAC, optimistic concurrency conflicts, Graph adapter mocks,
search and detail behavior in the UI, and camera moves in the 3D shelves.

## Architecture and operating limits

The repository contract is `LibraryRepository` in `src/lib/domain.ts`. There are two adapters
today: `src/lib/repositories/local.ts` and `src/lib/repositories/excel.ts`. The UI never calls Graph
directly; it goes through the `/api/library` and `/api/actions` server boundary. That leaves room
for a SharePoint list adapter later, but the current version has no real-time Excel↔SharePoint sync
or dual-write.

The Excel API does not provide database-level serializable transactions. The current version
re-checks `version` inside a workbook session before changing rows, but for heavy-use deployments
you should swap the adapter for a transactional store or add server-side serialization.

For a real deployment, register the exact HTTPS callback, keep environment variables in the
platform's secret store, and rotate `NEXTAUTH_SECRET` and the Entra client secret regularly.

## Author and license

- Author: LEE Inhee (이인희), CEO of Parandurume Inc. (파란두루미)
  - [Microsoft MVP](https://mvp.microsoft.com/en-US/MVP/profile/b4ef6855-0cce-ed11-a7c6-000d3a5603d3) (Microsoft Foundry)
  - Leader of the Power Platform Korean User Group and the Power Pages Korean User Group
- License: [GM-Social License v2.0](LICENSE). Use, change and share it freely, but if you deploy it
  in a production environment you must perform "social gratitude" within 90 days (Article 3.2 of
  the license).

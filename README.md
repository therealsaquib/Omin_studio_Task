# Omni Studio Task - Client Request Desk

A workspace-aware, multi-tenant inbox for customer requests. Team members can review, qualify, and update incoming customer requests, convert qualified requests into trackable work items, and inspect a full activity audit trail with strict workspace isolation.

---

## Features

- **Multi-Tenant Workspace Isolation**: Every query and mutation is strictly scoped to the authenticated user's signed JWT (`workspaceId` and `userId`). Cross-workspace data access is blocked.
- **Request Pipeline**: Manage request lifecycle through distinct statuses (`NEW` ➔ `QUALIFIED` ➔ `CLOSED`) with priority badges (`URGENT`, `IMPORTANT`, `NORMAL`).
- **One-Click Work Item Conversion**: Atomic conversion runs within an isolated SQLite transaction. It validates request eligibility, logs activity, and prevents race conditions with `UNIQUE(request_id)`.
- **Activity Timeline**: Automatic audit logging for request creation, status changes, and work item conversions with timestamp and actor details.
- **Filtering, Sorting & Pagination**: Search by customer name/details, filter by status, priority, or scheduled date, and sort dynamically.
- **Typography Design System**: Strict typographic hierarchy with Inter font:
  - **Dashboard Titles / Main Headers**: 24px–32px (Bold)
  - **KPI / Metric Big Numbers**: 24px–36px (Bold)
  - **Card Headers / Section Titles**: 14px–18px (Medium/Bold)
  - **Body Text / Primary Table Values**: 14px–16px (Regular)
  - **Chart Axis Values / Legends / Tooltips**: 10px–12px (Regular/Semi-bold)
  - **Captions / Footnotes / Microcopy**: 10px–12px

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js (>=22), Express, TypeScript (`tsx`), Better-SQLite3, Zod, JWT (`jsonwebtoken`), bcryptjs |
| **Frontend** | React 19, Vite 6, TypeScript, TanStack React Query, React Router DOM v7, Radix UI Dialog, Tailwind CSS v4, Lucide Icons |
| **Testing** | Vitest, Supertest, Testing Library (`@testing-library/react`), jsdom |

---

## Prerequisites

- **Node.js**: `v22` or newer (Windows users can use `fnm` or `nvm-windows`)
- **npm**: `v10` or newer

---

## Setup & Running Locally

### 1. Install Dependencies
```sh
npm install
```

### 2. Environment Configuration
Copy the sample environment file to `.env`:
```sh
# On Windows PowerShell:
Copy-Item ".env.example" ".env"

# On macOS/Linux:
cp .env.example .env
```

Ensure `.env` contains:
```env
PORT=4000
JWT_SECRET=FJ3LTyToVqfqZgZJIkzdjiMuxrLRVfXcBEEJ6zZvo4h
CLIENT_ORIGIN=http://localhost:5173
DEMO_PASSWORD=Demo@1234
DATABASE_PATH=./data/omni-client-system.sqlite
VITE_API_URL=http://localhost:4000
```

### 3. Seed the Database
Populate SQLite with starter workspaces, users, and demo requests:
```sh
npm run seed
```

### 4. Start the Application
Start both the API server (port `4000`) and the Vite client (port `5173`) concurrently:
```sh
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Demo Credentials

Log in with either demo workspace:

| Workspace | City | Email | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Pune Home Services** | Pune | `saqib@omni.example` | `Demo@1234` | ADMIN |
| **Chennai Beauty & Wellness** | Chennai | `ananya@chennaibeauty.example` | `Demo@1234` | ADMIN |

> `npm run seed` is idempotent and safe to rerun anytime to reset or refresh starter demo data.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs backend API server and frontend client concurrently |
| `npm run seed` | Seeds SQLite database with workspaces, demo users, and requests |
| `npm run test` | Runs the full test suite (backend API tests + frontend component tests) |
| `npm run build` | Compiles TypeScript and builds production bundles for server & client |

---

## Project Structure

```text
├── client/                     # Frontend SPA (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── auth/               # Auth context, session persistence & route guards
│   │   ├── components/         # Layout (AppShell), UI primitives, badges, states
│   │   ├── pages/              # Overview, Requests, RequestDetail, RequestForm, WorkItems, Activity
│   │   ├── api.ts              # API client methods with Zod validation
│   │   ├── styles.css          # Design system & typography hierarchy
│   │   └── types.ts            # Frontend shared TypeScript interfaces
│   └── tests/                  # Integration tests (React Testing Library + Vitest)
├── server/                     # Backend API (Express + Better-SQLite3)
│   ├── migrations/             # SQL schema migrations
│   ├── src/
│   │   ├── services/           # Business logic (requests, work items, activities)
│   │   ├── app.ts              # Express application configuration & routing
│   │   ├── auth.ts             # JWT authentication middleware & routes
│   │   ├── db.ts               # SQLite connection, WAL mode & migrations runner
│   │   ├── seed.ts             # Database seeder script
│   │   └── index.ts            # Server entry point
│   └── tests/                  # API integration tests (Supertest + Vitest)
├── .env.example                # Sample environment configuration
├── .gitignore                  # Git ignore rules for node_modules, .env, and SQLite files
└── package.json                # Workspace configuration and root scripts
```

---

## Key Architecture & Design Decisions

1. **Workspace Scoping & Token Integrity**:
   - The signed JWT is the single source of truth for `userId`, `workspaceId`, and `role`.
   - The client never selects or passes a workspace ID; queries automatically filter by token workspace.
   - Access attempts to other workspaces return `404 Not Found` rather than `403` to prevent tenant enumeration.

2. **Atomic Conversion Transaction**:
   - Converting a qualified request to a work item runs inside a single database transaction.
   - It checks that the request is in `QUALIFIED` status, inserts the work item, marks the request, and logs the audit event.
   - `UNIQUE(request_id)` on the `work_items` table acts as a database-level race condition safeguard.

3. **Optimistic Updates & Query Caching**:
   - Built on TanStack React Query with cache invalidation keys (`["requests"]`, `["overview"]`, `["work-items"]`, `["activities"]`) ensuring immediate UI synchronization across tabs and views.

---

## License

Private and proprietary. Built for Omni Studio technical assessment.

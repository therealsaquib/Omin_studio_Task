# Omin_studio_Task

A small, workspace-aware inbox for customer requests. Team members can review and update requests, then turn qualified requests into work items.

## Setup

Requires Node.js 22 or newer.

```sh
npm install
```

The root `npm run install` helper can also restore missing workspace dependencies.

Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random value. Then seed the local SQLite database and start both apps:

```sh
npm run seed
npm run dev
```

Open the Vite URL printed by the client (usually http://localhost:5173). The API runs on http://localhost:4000. Use either demo workspace:

| Workspace | Email | Password |
| --- | --- | --- |
| Northstar Home Services | `alex@northstar.test` | `DeskDemo2026!` |
| Riverbend Studio | `jamie@riverbend.test` | `DeskDemo2026!` |

`npm run seed` is safe to rerun and adds the two workspaces, users, and four starter requests per workspace. Run `npm test` for backend and frontend tests, or `npm run build` for production builds.

## Structure and key decisions

- `server/` contains the Express API, Zod validation, SQLite schema, seed script, and Supertest/Vitest tests.
- `client/` contains the React/Vite app, Tailwind styles, Radix-powered confirmation dialog, and React Testing Library tests.
- The signed JWT is the sole source of `userId` and `workspaceId`; clients cannot select a workspace. Every request, activity, and work-item lookup is scoped to the token workspace, and cross-workspace IDs appear not found.
- Conversion runs in one SQLite transaction. It verifies the request is qualified, returns an existing work item on repeat calls, and inserts the work item and activity together. `UNIQUE(request_id)` is the final race-condition guard.
- Activity records are written for request creation, edits, and successful conversion. Suggested actions only open an existing edit form or the conversion confirmation; they never change data automatically.

## Assumptions and trade-offs

- A user belongs to one workspace, and login identifies that workspace; there is no workspace selector or invitation flow.
- Request statuses are `NEW`, `QUALIFIED`, and `CLOSED`. Editing a request is the explicit way to change status; conversion is allowed only for qualified requests.
- SQLite and synchronous `better-sqlite3` keep this single-instance assignment easy to run. The browser keeps its short-lived access token in local storage; demo accounts share a documented password and are for local use only.
- The app uses a small set of custom Tailwind components and Radix UI primitives rather than a generated shadcn/ui component registry.

## With more time

I would add rate limiting and refresh-token rotation, move production data to Postgres with row-level security, and provide Docker-based local setup and deployment. I would also add workspace membership/invitations, stronger account/password management, and broader accessibility and end-to-end coverage.

## AI assistance and review

GitHub Copilot SDK in VS Code was used to help scaffold and refine the implementation. The output was reviewed against the workspace-isolation and conversion requirements, checked with the focused backend and frontend tests, and validated with TypeScript/production builds.

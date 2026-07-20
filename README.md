# Ajaia Docs

A lightweight collaborative document editor — built for the Ajaia AI-Native Full Stack Developer assignment.

**Features**

- Create, rename, edit, delete rich-text documents — bold, italic, underline, strikethrough, highlight, inline code, links, H1–H3, text alignment, bulleted/numbered/**task** lists, blockquotes, code blocks, horizontal rules, clear-formatting, undo/redo
- Autosave with a visible save indicator, plus a live word/character count
- Import a **.txt, .md, or .docx** file as a new editable document (stated in the UI; other types are rejected with a clear error)
- Share documents with other users as **editor** or **viewer**; owned vs. shared documents are visually distinct, and view-only users get a read-only editor
- Everything persists in Postgres via Prisma

**Stretch features** (all five from the brief, in pragmatic form)

- **Version history** — throttled snapshots on save (max 1/min, capped at 50 per doc) with one-click restore; restoring snapshots the current state first, so restores are reversible
- **Comments** — document-level discussion panel; any collaborator (including viewers) can comment, authors and the owner can delete
- **Presence indicators** — "viewing now" chips for others who currently have the doc open (10 s heartbeat polling)
- **Export** — download as Markdown, or PDF via a print stylesheet (browser's "Save as PDF")
- **Role-based sharing** — editor vs. view-only roles, enforced server-side

**Stack:** TypeScript everywhere · React 18 + Vite + TipTap · Express 4 · Prisma + PostgreSQL · Vitest + Supertest

## Demo accounts

| Email | Password | |
|---|---|---|
| `alice@ajaia.test` | `password123` | has a seeded welcome doc |
| `bob@ajaia.test` | `password123` | |
| `carol@ajaia.test` | `password123` | |

The login screen also has one-click sign-in buttons for these accounts. To demo sharing: sign in as Alice → open a doc → **Share** → `bob@ajaia.test` → sign out → sign in as Bob → the doc appears under *Shared with me*.

## Run locally

Prerequisites: Node 20+, Docker (for Postgres).

```bash
npm install                # installs server + client workspaces
npm run db:up              # starts Postgres 17 in Docker on port 5433
npm run db:migrate         # applies Prisma migrations (server/.env has the local DB URL;
                           #   if it's missing, copy server/.env.example → server/.env)
npm run dev                # API on :4101, Vite client on :5173
```

Open http://localhost:5173. Demo users are seeded automatically on server start.

No Docker? Point `DATABASE_URL` in `server/.env` at any Postgres 14+ database and skip `db:up`.

### Database GUI & extra users

```bash
npm run db:admin     # pgAdmin at http://localhost:5051 (admin@ajaia.dev / admin123)
                     #   the "Ajaia Docs" server is preconfigured — DB password: ajaia
npm run add-user -- dana@ajaia.test "Dana Kim" somepassword
```

Use `add-user` (not raw SQL) to create login-capable users — passwords are bcrypt-hashed, so hand-inserted rows can't sign in. pgAdmin is for inspecting documents, shares, revisions, and comments.

## Tests

```bash
npm test        # 22 API tests: auth, CRUD, sharing/permissions, file import,
                #   sanitization (XSS + rich-format round-trip), version history,
                #   comments, presence
npm run typecheck
```

Tests run against a dedicated `ajaia_docs_test` database (created automatically by the Docker init script) — they never touch dev data.

## Deploy

**Full step-by-step guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — free, no credit card.

Short version: create a free [Neon](https://neon.tech) Postgres database, then on
[Render](https://render.com) choose *New → Blueprint* and point it at this repo.
[render.yaml](render.yaml) configures the service; paste the Neon connection string
when prompted for `DATABASE_URL`. A [Dockerfile](Dockerfile) is included for any
container host as an alternative.

`npm start` runs `prisma migrate deploy` before booting and the server seeds demo
users on startup, so a fresh deployment is immediately reviewable with no manual
database setup. In production Express serves the built client too, so the whole
product is **a single service on one origin** — which also keeps the session
cookie first-party.

## Project layout

```
server/   Express API (TypeScript, tsx runtime)
  prisma/           schema + migrations
  src/routes/       auth, documents+sharing, upload
  test/             Vitest + Supertest API suite
client/   React SPA (TypeScript, Vite, TipTap)
  src/pages/        Login, Home (doc lists), Editor
  src/components/   Toolbar, ShareDialog
```

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).

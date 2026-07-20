# Ajaia Docs — AI-Native Full Stack Developer Assignment

**Rafay Farrukh** · rafayfarrukh941@gmail.com

| | |
|---|---|
| **Live app** | https://ajaia-docs-wu8u.onrender.com |
| **Google Drive folder** | https://drive.google.com/file/d/1bjKMSjjGU1MNLuYm68PkJFTQmTvhFvW7/view |
| **Source (GitHub)** | https://github.com/RafayFarrukh/Ajaia_Assessment |

A lightweight collaborative document editor: rich-text editing with autosave,
file import, and role-based sharing between users.

> **First load may take ~50 seconds.** The app is on a free hosting tier that
> sleeps after 15 minutes of inactivity. Every request after the first is fast.
> This is a hosting-plan characteristic, not application latency.

---

## Test accounts

No signup needed — the login screen has **one-click sign-in buttons** for each
account. All use password `password123`.

| Email | Password | Role in the demo |
|---|---|---|
| `alice@ajaia.test` | `password123` | Document owner (starts with a welcome doc) |
| `bob@ajaia.test` | `password123` | Share target — use for **"Can edit"** |
| `carol@ajaia.test` | `password123` | Share target — use for **"View only"** |

**Fastest way to review the sharing model (~2 minutes):**

1. Sign in as **Alice** → open a document → **Share**
2. Add `bob@ajaia.test` as **Can edit**, `carol@ajaia.test` as **View only**
3. Sign out → sign in as **Bob**: document appears under *Shared with me*, he can edit it, but has no Share button and cannot delete it
4. Sign out → sign in as **Carol**: same document is read-only — no toolbar, "View only" label

Permissions are enforced **server-side**, not just hidden in the UI. A user with
no access gets a `404` rather than a `403`, so document IDs cannot be probed.

---

## Stack

**TypeScript end to end.**

- **Frontend:** React 18 · Vite · TipTap (ProseMirror) · React Router
- **Backend:** Node 20 · Express 4 · Prisma ORM
- **Database:** PostgreSQL
- **Tests:** Vitest + Supertest (22 API tests)
- **Deployment:** Render (web service) + Neon (Postgres) — both free tier

The app deploys as **one service on one origin**: Express serves both the API
and the built React client. This keeps the session cookie first-party — a split
frontend/backend deployment would put them on different domains and silently
break `SameSite=Lax` cookie auth in production.

---

## What is working (end to end)

**Documents & editing**
- Create, rename, edit, and delete documents
- Rich text: **bold**, *italic*, underline, strikethrough, highlight, inline
  code, links, H1–H3, text alignment, bulleted / numbered / **task** lists
  (with working checkboxes), blockquotes, code blocks, horizontal rules,
  clear-formatting, undo/redo
- Autosave (debounced) with a live Saved / Saving… / Save failed indicator
- Live word and character count
- Formatting is preserved across refresh and reopen

**File upload**
- Import a **`.txt`, `.md`, or `.docx`** file → becomes a new editable document
  with its formatting converted to rich text
- Supported types are stated in the UI button label and the README
- Unsupported types and oversized files (>5 MB) are rejected with clear messages

**Sharing**
- Every document has an owner; owner shares by email
- Two roles: **editor** and **viewer**, enforced on every API route
- Home screen separates *My documents* from *Shared with me*, with badges
  showing the role and who shared it
- Access can be revoked; revoked users immediately lose visibility

**Persistence**
- PostgreSQL via Prisma with real migrations (applied automatically on deploy)
- Content stored as sanitized HTML; formatting round-trips faithfully
- Demo users and a welcome document are seeded on first boot

**Engineering quality**
- **22 automated API tests** covering auth, CRUD, permission escalation
  attempts, file import, XSS sanitization, version history, comments, presence
- Server-side HTML sanitization on every write — `<script>` tags and
  `javascript:` URLs are stripped (proven by tests)
- Validation and error handling: bad credentials, empty titles, oversized
  payloads, unknown share targets, unsupported file types
- Strict TypeScript on both workspaces; `npm run typecheck` is clean

**All five optional stretch features**
- **Version history** — throttled snapshots on save (max 1/min, 50 per doc)
  with one-click restore. Restoring snapshots the current state first, so a
  restore is itself reversible.
- **Comments** — document-level discussion panel; any collaborator can comment,
  authors and the document owner can delete
- **Real-time collaboration indicators** — presence chips show who else has the
  document open, and distinguish **"editing now"** (someone is actively saving
  changes) from **"viewing now"**
- **Export** — download as Markdown, or PDF via a print stylesheet that strips
  all UI chrome
- **Role-based sharing permissions** — editor vs. viewer, described above

---

## What is incomplete

- **No character-level real-time co-editing.** Collaboration is asynchronous:
  sharing with roles, presence indicators, and comments. Operational transforms
  or CRDTs are a project in their own right and nothing in the core brief
  required them.
- **No self-serve registration.** Users are seeded, which the brief explicitly
  permits. A CLI (`npm run add-user`) exists for creating additional accounts
  with correctly hashed passwords.
- **Concurrent edits are last-write-wins.** Two people editing the same document
  simultaneously can overwrite each other; there is no stale-write detection.
- **Comments are document-level**, not anchored to specific text ranges.
- **Presence is in-memory**, so it resets on server restart and would need Redis
  in a multi-instance deployment.

---

## What I would build next with 2–4 more hours

1. **Conflict safety** — an `updatedAt` precondition on document updates,
   returning `409` with a "this document changed elsewhere" banner. This is the
   most user-visible correctness gap today.
2. **Live content refresh for concurrent viewers** — poll `updatedAt` (or
   upgrade presence to WebSockets) so a viewer sees an editor's changes without
   a manual refresh.
3. **Text-anchored comments** using ProseMirror decorations and position
   mapping that survives edits.
4. **Production hardening** — rate limiting (`express-rate-limit`) and
   structured request logging (`pino`) before real users touch it.

---

## Run locally

**Prerequisites:** Node 20+ and Docker (for PostgreSQL).

```bash
npm install        # installs both workspaces
npm run db:up      # starts PostgreSQL 17 in Docker (port 5433)
npm run db:migrate # applies Prisma migrations
npm run dev        # API on :4101, client on :5173
```

Open **http://localhost:5173** — demo users are seeded automatically on server
start, so you can sign in immediately with the accounts above.

```bash
npm test           # 22 API tests
npm run typecheck  # strict TypeScript, both workspaces
```

**Optional extras**

```bash
npm run db:admin                                        # pgAdmin at :5051
npm run add-user -- dana@ajaia.test "Dana Kim" secret123  # create a user
```

No Docker? Point `DATABASE_URL` in `server/.env` at any PostgreSQL 14+ database
and skip `db:up`. See `server/.env.example`.

---

## Included in the Drive folder

| File | Contents |
|---|---|
| `README.md` | Setup, run instructions, feature list |
| `docs/ARCHITECTURE.md` | What I prioritized and why, scope cuts, tradeoffs |
| `docs/AI_WORKFLOW.md` | AI tools used, what I changed or rejected, verification |
| `docs/DEPLOYMENT.md` | Step-by-step free deployment guide |
| `SUBMISSION.md` | Index of deliverables |
| `server/` `client/` | Full source (npm workspaces) |

---

## Architecture summary

The full reasoning is in `docs/ARCHITECTURE.md`. The short version — I spent the
timebox on four things rather than covering more surface area shallowly:

1. **A solid editing loop.** Create → format → autosave → reopen. If this feels
   broken, nothing else matters. TipTap gives a production-grade editing model
   without building one from scratch.
2. **Access control that actually holds.** One `getDocAccess` helper resolves
   permissions for every document route, so the rules can't drift between
   endpoints.
3. **Honest persistence.** Real migrations, sanitized HTML storage, formatting
   that survives a round-trip.
4. **Verifiability.** Tests that cover the flows a reviewer will actually try,
   including permission-escalation attempts and XSS payloads.

**Deliberate cuts:** real-time co-editing (a project unto itself), self-serve
registration (seeded users are explicitly allowed and reduce surface area), and
attachment storage (import-as-document delivers more product value per hour).

**Notable decision:** content is stored as sanitized HTML rather than TipTap
JSON. It is human-readable in the database, trivially importable from Markdown
and DOCX, and safe to render anywhere because every write passes an allowlist
sanitizer.

---

## AI workflow summary

The full note is in `docs/AI_WORKFLOW.md`.

**Tool used:** Claude Code (Anthropic's CLI agent). No other AI tools.

**Where it materially helped:** scaffolding both applications; a mid-project
stack migration (the first working version used raw SQL on SQLite — I decided
the final product should be TypeScript + Prisma + PostgreSQL, and the whole
codebase was converted in one pass while keeping the API contract identical);
drafting the test suite; and driving a real browser to verify flows.

**What I changed or rejected:**

- **Caught a real AI-introduced bug through verification, not luck.** Opening a
  shared document fired a phantom autosave, because TipTap's `setEditable()`
  emits an update event by default. For view-only users this surfaced as a
  spurious permission error on open. Fixed by suppressing that event and
  guarding the autosave path on `editor.isEditable`.
- **Rejected the AI's test-database strategy.** Its first approach reset the
  schema with `prisma db push --force-reset`. Prisma's CLI flags that as
  destructive; rather than override the guard, I redesigned the setup around
  non-destructive `migrate deploy` plus explicit cleanup — a better design
  regardless.
- **Rejected generated port and infrastructure assumptions** that collided with
  services already running on my machine.

**How I verified:** 22 automated tests through the real HTTP stack against a
real PostgreSQL database (no mocked persistence); strict typechecking on both
workspaces; and manual browser passes of every flow as each of the three demo
users. Before deploying, I reproduced the production environment in a clean
clone against a virgin database to confirm migrations, seeding, and static-file
serving all worked — which caught a real deployment bug (`NODE_ENV=production`
causing npm to skip the build tooling) before it could waste reviewer time.

Judgment stayed mine: scope cuts, the storage format, the access-control model,
returning 404 instead of 403, and what to do when the AI's approach was wrong.

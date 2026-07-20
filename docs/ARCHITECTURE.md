# Architecture note

## What I prioritized, and why

The assignment rewards a coherent product slice over broad shallow coverage. I spent the timebox on four things:

1. **A solid editing loop** — create → type with formatting → autosave → reopen. This is the product's core; if it feels broken, nothing else matters. TipTap (ProseMirror) gives a production-grade editing model in minutes rather than days, and its HTML serialization keeps storage and rendering simple.
2. **Working access control** — a real owner/editor/viewer model enforced server-side on every route, not just hidden buttons in the UI. Permission checks live in one helper (`getDocAccess`), so every document route resolves access the same way. Inaccessible documents return **404, not 403**, so document IDs can't be probed.
3. **Persistence that survives honestly** — Postgres via Prisma with a real migration, seeded demo users, and content stored as sanitized HTML so formatting round-trips faithfully.
4. **Verifiability** — 15 API tests covering the flows a reviewer will try (including permission escalation attempts and XSS payloads), typechecking on both sides, and a one-command local setup.

## Key decisions

- **Single deployable service.** In production, Express serves the built SPA and the API from one process. One service + one database is the cheapest thing to deploy, review, and reason about at this scope.
- **HTML as the storage format.** TipTap can emit JSON or HTML. HTML is human-readable in the DB, trivially importable from Markdown/DOCX, and good enough for this feature set. All content is sanitized server-side on write (allowlist of tags/attributes), so stored content is safe to render — the XSS test proves `<script>` never survives.
- **Cookie JWT auth with seeded users.** The assignment explicitly allows simulated users. An httpOnly cookie (SameSite=Lax, Secure in prod) avoids localStorage token pitfalls, while bcrypt-hashed passwords keep the login flow honest. The "demo users" endpoint that powers one-click login is an assignment convenience I would never ship in a real product (and is flagged as such in the code).
- **File import creates a new document** rather than attaching blobs. It exercises a real product loop (upload → parse → editable content) without needing object storage. `.txt` is paragraph-split and HTML-escaped, `.md` goes through `marked`, `.docx` through `mammoth`; everything then passes the same sanitizer as user edits.
- **Autosave with a debounce** (800 ms) plus a visible Saved/Saving/Save-failed indicator — closer to the Google Docs mental model than an explicit save button, and cheap to implement well.
- **Tests hit a dedicated test database** (`ajaia_docs_test`, provisioned by the Docker init script) through the real Express app via Supertest — no mocking of the persistence layer, so the tests exercise Prisma queries and constraint behavior for real.

## Stretch features — how they're scoped

All five optional enhancements were added *after* the core was complete and tested, each in a deliberately lightweight form:

- **Version history:** snapshots are captured on content saves but throttled (one per minute, 50 per document) so autosave doesn't produce a revision per keystroke. Restore snapshots the current state first — a restore is never destructive.
- **Comments** are document-level rather than anchored to text ranges. Range anchoring requires ProseMirror position mapping that survives edits — real complexity for marginal demo value. Any collaborator can comment (viewers included, matching the "commenter" intuition); only the author or the doc owner can delete.
- **Presence** is a 10-second heartbeat into an in-memory map, not websockets. At single-process scale this gives honest "who else is here" signal with ~30 lines of code and zero infrastructure. It intentionally does not survive restarts and would need Redis pub/sub in a multi-instance deployment.
- **Export:** Markdown via Turndown on the client (the editor already holds the HTML); PDF via a print stylesheet that strips all chrome — the browser's "Save as PDF" does the rendering. No server-side PDF pipeline to maintain.
- **Role-based sharing** (editor/viewer) was part of the core build rather than an add-on.

## What I deliberately cut

- **Real-time co-editing.** CRDTs or OT are a project on their own; nothing in the core asks for them. The collaborative slice here is asynchronous sharing with roles, presence indicators, and comments.
- **Registration / password reset.** Seeded accounts demonstrate the sharing model with less surface area.
- **Attachment storage.** Import-as-document delivers the file-upload requirement with more product value per hour.
- **Optimistic concurrency.** Last-write-wins between two simultaneous editors of the same doc. Acceptable at this scope; the fix (version column + 409 on stale writes) is the first thing I'd add.

## Next 2–4 hours

1. Conflict safety: `updatedAt` precondition on PATCH with a "document changed elsewhere" banner (currently last-write-wins).
2. Text-anchored comments (ProseMirror decorations + position mapping).
3. Live content refresh for concurrent viewers (poll `updatedAt` or upgrade presence to websockets).
4. Rate limiting and request logging (express-rate-limit + pino) before real users touch it.

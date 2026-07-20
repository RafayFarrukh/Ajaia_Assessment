# AI workflow note

## Tools used

- **Claude Code** (Anthropic's CLI agent, Fable 5 model) for essentially all code generation, debugging, and browser-based verification.
- No other AI tools.

## Where AI materially sped things up

- **Scaffolding both apps** — the Express + Prisma API and the React + TipTap client, including the toolbar, share dialog, and autosave logic, were generated far faster than hand-writing.
- **A mid-project stack migration.** The first working version used raw SQL on SQLite. I decided the final product should be TypeScript + Prisma + Postgres, and the agent converted the entire codebase — schema, routes, tests, client — in one pass while keeping the API contract identical, then re-verified everything.
- **Test authorship.** The 15-test API suite (including permission-escalation and XSS cases) was AI-drafted and then reviewed/tightened by me.
- **In-browser verification.** The agent drove a real browser against the running app: signed in as each demo user, typed into the editor, shared documents, and checked the database directly to confirm persistence.
- **The stretch round.** With the core done and tested, all five optional enhancements (version history, comments, presence, export, roles) were added in a single AI-assisted pass — schema migration, routes, UI panels, and five new API tests — then verified live (e.g. simulating a second viewer via API heartbeats to see the presence chip appear).

## AI output I changed or rejected

- **Caught a real AI-introduced bug via verification, not luck:** opening a shared document fired a phantom autosave, because TipTap's `setEditable()` emits an `update` event by default. For view-only users this surfaced as a spurious "You have view-only access" error on open. Fixed by suppressing the event and guarding the autosave path on `editor.isEditable`.
- **Rejected the AI's test-reset approach.** The first version reset the test schema with `prisma db push --force-reset`. Prisma's CLI rightly flags that as a destructive action; rather than overriding the guard, the setup was redesigned to use non-destructive `migrate deploy` plus explicit row cleanup in the suite.
- **Port assumptions.** Generated configs assumed ports 3001/5432, both already occupied on my machine by unrelated projects. The final setup pins the API to 4101 and runs its own Postgres container on 5433 instead of touching existing services.
- **Coordinate-based browser clicks corrupted a test document** during automated verification (stray clicks hit toolbar buttons). The document was restored via the API; it was a test-process issue, not an app bug, but it's why the final verification pass re-checked stored content against the database.

## How correctness, UX and reliability were verified

- **Automated:** 15 Vitest + Supertest tests through the real HTTP stack against a real Postgres test database; `tsc --noEmit` on both workspaces; a production-mode smoke test (built client served by Express).
- **Manual/agent-driven UI passes:** every core flow exercised in a real browser — login (all three users), create/rename/edit with formatting, autosave indicator, import (.md via UI-equivalent API call), share as editor and as viewer, revoke, owned-vs-shared distinction, read-only enforcement — with stored HTML inspected in Postgres after edits to confirm formatting round-trips.
- **Judgment stayed human:** scope cuts, the storage format, the access-control model, 404-over-403, and what to do when the AI's approach was wrong were my decisions.

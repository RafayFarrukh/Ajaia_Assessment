# Submission — Ajaia Docs

Candidate: Rafay Farrukh (rafayfarrukh941@gmail.com)

## What's included

| Item | Location |
|---|---|
| Source code | this folder (`server/` + `client/`, npm workspaces) |
| Setup & run instructions | [README.md](README.md) |
| Architecture note | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| AI workflow note | [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) |
| Automated tests | `server/test/api.test.ts` (22 tests) — `npm test` |
| Deployment config & guide | [render.yaml](render.yaml) · [Dockerfile](Dockerfile) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Live product URL | **TODO — add before submitting** |
| Walkthrough video URL | [VIDEO_URL.txt](VIDEO_URL.txt) — **TODO — add before submitting** |

## Test accounts

No signup needed — the login screen has **one-click buttons** for each account.

| Email | Password | Use for |
|---|---|---|
| `alice@ajaia.test` | `password123` | document owner (starts with a welcome doc) |
| `bob@ajaia.test` | `password123` | share target — "can edit" role |
| `carol@ajaia.test` | `password123` | share target — "view only" role |

**To review the sharing flow:** sign in as Alice → open a document → **Share** →
add `bob@ajaia.test` as *Can edit* and `carol@ajaia.test` as *View only* → sign
out → sign in as each of them to see the document under *Shared with me* with
their respective permissions.

> **Note on the live URL:** it is hosted on a free tier that sleeps after ~15
> minutes of inactivity, so **the very first page load may take up to ~50
> seconds** while the instance wakes up. Everything is fast after that. This is
> a hosting-plan characteristic, not application latency.

## What is working (end to end)

- Sign in/out with seeded users
- Create, rename, edit, delete documents; rich formatting (bold/italic/underline/strike/highlight/inline code/links/H1–H3/alignment/bullet+numbered+task lists/blockquote/code block) persists across refresh; live word count
- Autosave with saved/saving/failed indicator
- Import `.txt` / `.md` / `.docx` as a new editable document (unsupported types rejected with a clear message)
- Share by email as **can edit** or **view only**; revoke access; owned vs. shared sections; server-enforced permissions (viewers cannot write, editors cannot delete/re-share, non-collaborators get 404)
- Validation & error handling: bad credentials, empty titles, oversized files/documents, unknown share targets, XSS payload sanitization
- **All five optional stretch features:** version history with restore · document-level comments · presence ("viewing now") indicators · export to Markdown / PDF (print) · editor-vs-viewer roles

## What is incomplete

- No real-time co-editing (character-level sync) — collaboration is asynchronous sharing + presence + comments by design (see architecture note)
- No self-serve registration; users are seeded
- Two people editing the same doc simultaneously is last-write-wins
- Comments are document-level, not anchored to text ranges

## With another 2–4 hours

Stale-write detection (409 + banner), text-anchored comments, live content refresh for concurrent viewers, rate limiting + structured logging.

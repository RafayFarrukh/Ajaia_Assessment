# Deployment guide (100% free)

The whole product deploys as **one service**: Express serves the API *and* the
built React client from the same origin. That keeps the session cookie
first-party (it is `SameSite=Lax`, so splitting the frontend onto a separate
domain would silently break login) and means there is only one thing to deploy.

**Stack:** [Neon](https://neon.tech) for Postgres (free, no expiry) +
[Render](https://render.com) for the web service (free). Neither requires a
credit card for these tiers.

> Provider dashboards change their wording occasionally — button names below
> may differ slightly, but the sequence is the same.

---

## Step 1 — Create the database (Neon, ~2 minutes)

1. Sign up at **neon.tech** (GitHub login is fastest).
2. Create a project — name it `ajaia-docs`. Any region is fine; picking one
   near your Render region is marginally faster.
3. On the project dashboard, copy the **connection string**. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-something-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this tab open — you need the string in Step 2.

Nothing else to do here. The app creates its own tables on first boot.

## Step 2 — Deploy the app (Render, ~5 minutes)

1. Sign up at **render.com** and connect your GitHub account.
2. **New → Blueprint**, then pick the `Ajaia_Assessment` repository.
   Render reads [`render.yaml`](../render.yaml) and pre-fills everything.
3. It will prompt for the one value it cannot guess: **`DATABASE_URL`**.
   Paste the Neon connection string from Step 1.
4. Click **Apply / Create**. First build takes ~3–5 minutes.

On boot the service automatically runs `prisma migrate deploy` (creates all
tables) and seeds the three demo users plus a welcome document — so the app is
immediately reviewable with no manual database work.

## Step 3 — Verify (2 minutes)

Visit your Render URL (`https://ajaia-docs-XXXX.onrender.com`) and check:

- [ ] `/api/health` returns `{"ok":true}`
- [ ] The login screen lists the demo accounts, and one-click sign-in works
- [ ] Create a document, type formatted text, **refresh** — content persists
- [ ] Share with `bob@ajaia.test`, sign in as Bob, confirm it appears under
      *Shared with me*
- [ ] Reload a deep link like `/doc/1` directly — it loads (SPA fallback)

If login works on the deployed URL, the HTTPS + `secure` cookie path is
correct — that is the single most common thing to break in production.

---

## Known free-tier behavior (worth telling reviewers)

**Cold starts.** Render's free web services sleep after ~15 minutes of
inactivity. The first request afterwards can take **~50 seconds** while the
instance wakes; every request after that is fast. This is noted in
`SUBMISSION.md` so reviewers don't mistake it for a broken app.

*Optional:* hit the URL yourself a few minutes before you expect it to be
reviewed, or point a free uptime pinger (e.g. UptimeRobot) at
`/api/health` every 10 minutes to keep it warm.

**Neon idle suspend.** Neon's free compute suspends when idle but resumes in
well under a second — not noticeable in practice.

**Why not Render's own free Postgres?** It is deleted roughly 30 days after
creation. If the review happens after that window, the app would be up but
every request would fail. Neon's free tier has no such expiry, which is worth
the one extra copy-paste.

---

## Alternative: any container host

If you would rather use Railway, Fly.io, or similar, the
[`Dockerfile`](../Dockerfile) builds the same single service. Supply two
environment variables and expose the port the platform assigns:

- `DATABASE_URL` — any Postgres 14+ connection string
- `JWT_SECRET` — any long random string

Note that Railway and Fly.io now require a payment method even on their
trial/hobby tiers, which is why Render is the recommended path here.

## Redeploying after a change

Push to `main` — Render rebuilds automatically. Migrations run on every boot
and are idempotent, so schema changes ship with the code.

# Generation

> "No followers. No popularity contest. Just your generation."

A verified-cohort social platform. This repo is being built in phases — see progress below.

## Build phases

- [x] **Phase 0** — Repo scaffolding & tooling
- [x] **Phase 1** — Database schema & migrations
- [x] **Phase 2** — Auth (register/login, JWT, bcrypt) — *backend done, frontend next*
- [x] **Phase 3** — Cohort selection + verification workflow — *backend done, frontend next*
- [x] **Phase 4** — Profile (view public profile, update own profile) — *backend done, frontend next*
- [x] **Frontend Phase 1** — Landing page, register/login, cohort verification onboarding, account home
- [ ] Phase 5 — Feed (posts, comments, reactions, saves)
- [ ] Phase 6 — Communities
- [ ] Phase 7 — Messaging
- [ ] Phase 8 — Help section
- [ ] Phase 9 — Notifications
- [ ] Phase 10 — Search & discovery
- [ ] Phase 11 — Reporting & moderation
- [ ] Phase 12 — Admin dashboard
- [ ] Phase 13 — Premium tier scaffold
- [ ] Phase 14 — Deployment prep, seed data, tests, README polish

## Local development setup

### 1. Database

You need a local PostgreSQL 15+ instance.

```bash
createdb generation_db
createuser generation_user --pwprompt   # set a password, matches DATABASE_URL below
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env — set DATABASE_URL and a real JWT_SECRET
npm install
npm run migrate      # applies migrations/*.sql in order
npm run dev           # starts on http://localhost:4000
```

Run tests (needs the DB migrated first, ideally a separate test DB):

```bash
npm test
```

Try it:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password","displayName":"You"}'
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

The dev server proxies any request to `/api/*` straight to the backend
at `http://localhost:4000`, so there's no CORS setup needed locally —
just make sure the backend is running first.

Open http://localhost:5173 — you'll land on the homepage, and can
register, log in, verify your cohort with a document upload, and see
your account home with your verified badge once approved.

## Environment variables

See `backend/.env.example` for the full list. Nothing is hardcoded — all
secrets (DB credentials, JWT secret, storage keys) come from environment
variables, and `.env` is gitignored.

## Notes on verification documents

Verification documents are referenced only by an object-storage key
(`verification_requests.document_storage_key`), never stored in the
database and never exposed via any public API. The storage adapter is
not yet connected to a real provider — see `STORAGE_PROVIDER=local` in
`.env.example`, which is for local dev only and must be replaced with a
real object storage provider (S3, R2, etc.) before production use.

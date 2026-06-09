# A&R Dashboard

Full-stack A&R pipeline tracker. React + Vite + TypeScript frontend, Supabase (Postgres) backend, deployed to Vercel.

---

## Project structure

```
A&R Dashboard/
├── app/                        # Vite React app (deploy this to Vercel)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client
│   │   │   └── types.ts        # All TypeScript types + helpers
│   │   ├── components/
│   │   │   ├── PipelineView.tsx
│   │   │   ├── OnboardingView.tsx
│   │   │   ├── EditableCell.tsx
│   │   │   ├── StagePill.tsx
│   │   │   └── AddArtistModal.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   └── vercel.json
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## 1 — Supabase setup

1. Create a new project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard → **SQL Editor**, paste and run the contents of `supabase/migrations/001_initial_schema.sql`.
3. From **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## 2 — Local development

```bash
cd app
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## 3 — Deploy to Vercel

### Option A — Vercel CLI

```bash
cd app
npx vercel
```

When prompted:
- **Root directory**: `app`
- **Build command**: `npm run build` (default)
- **Output directory**: `dist` (default)

Then add environment variables in the Vercel dashboard (**Settings → Environment Variables**):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Option B — GitHub import

1. Push this repo to GitHub.
2. Import it in [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to `app`.
4. Add the two env vars above.

---

## Features

### Pipeline view
- Full spreadsheet-style table matching the xlsx column layout exactly.
- **Inline editing** on every field — click any cell to edit, press Enter or click away to save directly to Supabase.
- **7-Day Growth %** columns are computed client-side from current/prev week values (not stored).
- **Stage pill** with color coding: Radar (gray), Contacted (blue), In Conversation (yellow), Passed to Ben (red), Passed (dark gray), Signed (green).
- **Ben-Sendable** is a checkbox toggle — no dropdown.
- **Add Artist** button opens a modal with all fields.
- **Delete** button with confirmation dialog per row.

### Onboarding Checklist view
- One row per artist, auto-populated when an artist is added (via Supabase trigger).
- Six checkbox columns — each click saves immediately to Supabase.
- When all six are checked, row turns green and shows an **Onboarded ✓** badge.
- Shows total count of fully-onboarded artists in the header.

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

# StudyPilot

Outline-first studying with branchable AI conversations.
Drop in your course notes → AI generates a hierarchical outline → ask focused
questions on any node by "pulling a branch" → merge the answer back into the
outline as a summary. Built so long ChatGPT chats can't lose context anymore.

## Stack

- Next.js 16 (App Router, TS, Tailwind)
- Supabase (Postgres + Auth + Storage)
- AI providers: Claude API, OpenAI API, OpenCode API (wired in Phase 1.5)

## Phase 1 setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. Wait ~2 min for it to provision.
3. In **Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configure env

```bash
cp .env.local.example .env.local
# fill in the Supabase values
```

### 3. Run the migration

Open the SQL editor in your Supabase dashboard, paste the contents of
`supabase/migrations/0001_init.sql`, and run.

(Or via Supabase CLI: `supabase db push` after linking the project.)

### 4. Configure Auth

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

In **Authentication → Providers → Email**: ensure "Enable Email provider" is on
and "Confirm email" / magic links are enabled (the default).

### 5. Run it

```bash
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`. Enter your
email, click the link in your inbox, and you're in.

## Project layout

```
app/
  login/              magic-link form + server action
  auth/callback/      OTP exchange route
  auth/signout/       sign-out route
  page.tsx            authenticated landing (will become course list in Phase 2)
lib/
  supabase/           server / client / middleware
  db/types.ts         row types (replace with `supabase gen types` later)
  providers/          AI provider abstraction (Phase 1.5)
middleware.ts         session refresh + auth guard
supabase/migrations/  SQL schema + RLS
```

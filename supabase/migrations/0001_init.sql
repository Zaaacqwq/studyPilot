-- StudyPilot initial schema
-- Run this in Supabase SQL editor, or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------- courses ----------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  default_provider text not null default 'claude'
    check (default_provider in ('claude','openai','opencode')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_user_idx on public.courses(user_id);

-- ---------- source_documents ----------
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('text','pdf','image','docx','pptx')),
  filename text,
  storage_path text,
  raw_text text,
  token_count integer,
  created_at timestamptz not null default now()
);
create index source_documents_course_idx on public.source_documents(course_id);

-- ---------- outline_nodes ----------
create table public.outline_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  parent_id uuid references public.outline_nodes(id) on delete cascade,
  title text not null,
  summary_md text,
  position integer not null default 0,
  depth integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outline_nodes_course_idx on public.outline_nodes(course_id);
create index outline_nodes_parent_idx on public.outline_nodes(parent_id);

-- ---------- branches ----------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.outline_nodes(id) on delete cascade,
  title text not null,
  status text not null default 'open'
    check (status in ('open','merged','abandoned')),
  provider text not null check (provider in ('claude','openai','opencode')),
  model text,
  summary_md text,
  created_at timestamptz not null default now(),
  merged_at timestamptz
);
create index branches_node_idx on public.branches(node_id);

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index messages_branch_idx on public.messages(branch_id, created_at);

-- ---------- provider_credentials ----------
-- Stores per-user API keys for each provider.
-- NOTE: stored plaintext in MVP. Harden later with Supabase Vault or pgsodium.
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('claude','openai','opencode')),
  api_key text not null,
  base_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();
create trigger trg_outline_nodes_touch before update on public.outline_nodes
  for each row execute function public.touch_updated_at();
create trigger trg_provider_credentials_touch before update on public.provider_credentials
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.courses              enable row level security;
alter table public.source_documents     enable row level security;
alter table public.outline_nodes        enable row level security;
alter table public.branches             enable row level security;
alter table public.messages             enable row level security;
alter table public.provider_credentials enable row level security;

create policy "courses_owner" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "source_documents_owner" on public.source_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outline_nodes_owner" on public.outline_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "branches_owner" on public.branches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages_owner" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "provider_credentials_owner" on public.provider_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Storage bucket for uploaded notes ----------
insert into storage.buckets (id, name, public)
values ('course-uploads', 'course-uploads', false)
on conflict (id) do nothing;

-- Storage RLS: object path must start with the user's UID.
-- Example path: <auth.uid()>/<course_id>/<uuid>.pdf
create policy "course_uploads_owner_select"
  on storage.objects for select
  using (bucket_id = 'course-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "course_uploads_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'course-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "course_uploads_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'course-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

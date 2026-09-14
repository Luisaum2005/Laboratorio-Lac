create type public.conference_status as enum ('draft', 'processing');

create table public.conferences (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  status public.conference_status not null default 'draft',
  source_file_path text unique,
  source_file_uploaded_at timestamptz,
  processing_requested_at timestamptz,
  created_at timestamptz not null default now()
);

create index conferences_created_by_created_at_idx on public.conferences (created_by, created_at desc);

alter table public.conferences enable row level security;
revoke all on table public.conferences from anon, authenticated;
grant select on table public.conferences to authenticated;
grant select, insert, update on table public.conferences to service_role;

create policy "operators read their own conferences"
on public.conferences for select to authenticated
using ((select private.has_active_profile()) and (select auth.uid()) = created_by);

-- Files stay private. Application users get no Storage object policy; all upload,
-- signing and parser handoff happens through the server using the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unimed-guides', 'unimed-guides', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

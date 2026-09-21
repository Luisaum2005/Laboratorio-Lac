alter table public.conferences
  add column parent_conference_id uuid references public.conferences(id) on delete restrict,
  add column revision_number integer not null default 1 check (revision_number > 0),
  add constraint conferences_parent_revision_number_key unique (parent_conference_id, revision_number);

create table public.conference_revision_changes (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  parent_conference_id uuid not null references public.conferences(id) on delete restrict,
  changed_exam_ids bigint[] not null default '{}',
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now()
);

create index conference_revision_changes_conference_id_idx on public.conference_revision_changes (conference_id);
create index conference_revision_changes_parent_conference_id_idx on public.conference_revision_changes (parent_conference_id);
create index conference_revision_changes_recorded_by_idx on public.conference_revision_changes (recorded_by);

alter table public.conference_revision_changes enable row level security;
revoke all on public.conference_revision_changes from anon, authenticated;
grant select on public.conference_revision_changes to authenticated;
grant select, insert on public.conference_revision_changes to service_role;

create policy "operators read their own revision changes"
on public.conference_revision_changes for select to authenticated
using (
  (select private.has_active_profile())
  and exists (
    select 1 from public.conferences
    where conferences.id = conference_revision_changes.conference_id
      and conferences.created_by = (select auth.uid())
  )
);

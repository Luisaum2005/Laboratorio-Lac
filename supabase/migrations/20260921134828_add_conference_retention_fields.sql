alter table public.conferences
  add column purged_at timestamptz,
  add column purge_reason text,
  add column purge_run_id uuid,
  add constraint conferences_purged_fields_check check (
    status <> 'purged' or (purged_at is not null and purge_reason = 'retention_expired')
  );

create index conferences_retention_candidates_idx
  on public.conferences (created_at)
  where purged_at is null;

create table public.conference_retention_audits (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete restrict,
  run_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('system', 'administrator')),
  status text not null check (status in ('completed', 'failed')),
  reason text not null check (reason = 'retention_expired'),
  created_at timestamptz not null default now(),
  unique (conference_id, run_id, status)
);

create index conference_retention_audits_created_at_idx
  on public.conference_retention_audits (created_at desc);
create index conference_retention_audits_actor_user_id_idx
  on public.conference_retention_audits (actor_user_id)
  where actor_user_id is not null;

alter table public.conference_retention_audits enable row level security;
revoke all on public.conference_retention_audits from anon, authenticated;
grant select, insert on public.conference_retention_audits to service_role;

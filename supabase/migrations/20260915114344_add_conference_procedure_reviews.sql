create type public.procedure_review_resolution as enum (
  'auto_matched',
  'needs_review',
  'confirmed',
  'replaced',
  'excluded'
);

create table public.conference_procedure_reviews (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  source_index integer not null check (source_index >= 0),
  raw_text text not null check (btrim(raw_text) <> ''),
  normalized_text text not null check (btrim(normalized_text) <> ''),
  source_page integer not null check (source_page > 0),
  procedure_code text not null check (btrim(procedure_code) <> ''),
  procedure_description text not null check (btrim(procedure_description) <> ''),
  requested_quantity integer not null check (requested_quantity >= 0),
  authorized_quantity integer not null check (authorized_quantity >= 0),
  is_authorized boolean not null,
  resolution public.procedure_review_resolution not null,
  matched_exam_id bigint references public.exams(id) on delete set null,
  resolved_exam_id bigint references public.exams(id) on delete restrict,
  expanded_exam_ids bigint[] not null default '{}',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conference_id, source_index),
  check (
    (resolution in ('auto_matched', 'confirmed', 'replaced') and resolved_exam_id is not null)
    or (resolution in ('needs_review', 'excluded') and resolved_exam_id is null)
  )
);

create index conference_procedure_reviews_conference_id_idx
  on public.conference_procedure_reviews (conference_id, source_index);

alter table public.conference_procedure_reviews enable row level security;
revoke all on table public.conference_procedure_reviews from anon, authenticated;
grant select on table public.conference_procedure_reviews to authenticated;
grant select, insert, update, delete on table public.conference_procedure_reviews to service_role;

create policy "operators read their own procedure reviews"
on public.conference_procedure_reviews for select to authenticated
using (
  (select private.has_active_profile())
  and exists (
    select 1
    from public.conferences
    where conferences.id = conference_procedure_reviews.conference_id
      and conferences.created_by = (select auth.uid())
  )
);

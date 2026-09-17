alter table public.conferences
  add column doctor_name text,
  add column doctor_is_manual boolean not null default true;

create table public.conference_medical_request_items (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete restrict,
  raw_text text not null check (btrim(raw_text) <> ''),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (conference_id, exam_id)
);

create index conference_medical_request_items_conference_id_idx
  on public.conference_medical_request_items (conference_id);

alter table public.conference_medical_request_items enable row level security;
revoke all on table public.conference_medical_request_items from anon, authenticated;
grant select on table public.conference_medical_request_items to authenticated;
grant select, insert, update, delete on table public.conference_medical_request_items to service_role;

create policy "operators read their own medical request items"
on public.conference_medical_request_items for select to authenticated
using (
  (select private.has_active_profile())
  and exists (
    select 1 from public.conferences
    where conferences.id = conference_medical_request_items.conference_id
      and conferences.created_by = (select auth.uid())
  )
);

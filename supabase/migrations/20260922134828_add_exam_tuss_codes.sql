create table public.exam_tuss_codes (
  tuss_code text primary key check (tuss_code ~ '^[0-9]{8}$'),
  exam_id bigint not null references public.exams(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index exam_tuss_codes_exam_id_idx on public.exam_tuss_codes (exam_id);

alter table public.exam_tuss_codes enable row level security;
revoke all on table public.exam_tuss_codes from anon, authenticated;
grant select on table public.exam_tuss_codes to authenticated;

create policy "authenticated users read TUSS codes"
on public.exam_tuss_codes for select to authenticated
using ((select auth.uid()) is not null);

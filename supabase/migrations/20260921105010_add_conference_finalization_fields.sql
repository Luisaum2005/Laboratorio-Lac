alter table public.conferences
  add column finalized_at timestamptz,
  add column finalized_by uuid references auth.users(id) on delete restrict,
  add column final_pdf_path text unique,
  add column final_snapshot jsonb,
  add constraint conferences_finalization_fields_check check (
    (status <> 'finalized') or (
      finalized_at is not null
      and finalized_by is not null
      and final_pdf_path is not null
      and final_snapshot is not null
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lac-forms', 'lac-forms', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

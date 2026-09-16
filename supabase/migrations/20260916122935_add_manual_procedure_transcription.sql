create type public.procedure_review_origin as enum ('extracted', 'manual');

alter table public.conference_procedure_reviews
  add column entry_origin public.procedure_review_origin not null default 'extracted',
  alter column source_page drop not null,
  alter column procedure_code drop not null;

alter table public.conference_procedure_reviews
  add constraint conference_procedure_reviews_manual_source_check check (
    (entry_origin = 'extracted' and source_page is not null and procedure_code is not null)
    or (entry_origin = 'manual' and source_page is null and procedure_code is null)
  );

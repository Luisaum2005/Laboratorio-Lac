alter table public.conferences
  add column extraction_result jsonb,
  add column extraction_completed_at timestamptz;

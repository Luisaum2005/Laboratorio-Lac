alter table public.conference_retention_audits
  drop constraint conference_retention_audits_status_check,
  drop constraint conference_retention_audits_conference_id_run_id_status_key,
  add constraint conference_retention_audits_status_check check (status in ('pending', 'completed', 'failed')),
  add constraint conference_retention_audits_conference_id_key unique (conference_id);

alter table public.conferences
  drop constraint conferences_purged_fields_check,
  add constraint conferences_purged_fields_check check (
    status <> 'purged' or (purged_at is not null and purge_reason in ('retention_expired', 'user_requested'))
  );

alter table public.conference_retention_audits
  drop constraint conference_retention_audits_actor_type_check,
  drop constraint conference_retention_audits_reason_check,
  add constraint conference_retention_audits_actor_type_check check (actor_type in ('system', 'administrator', 'operator')),
  add constraint conference_retention_audits_reason_check check (reason in ('retention_expired', 'user_requested'));

grant update on public.conference_retention_audits to service_role;

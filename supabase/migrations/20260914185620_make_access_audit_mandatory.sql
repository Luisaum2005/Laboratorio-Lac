alter table public.access_audit_events
  alter column target_user_id drop not null,
  add column status text not null default 'completed'
    check (status in ('pending', 'completed'));

grant update on table public.access_audit_events to service_role;

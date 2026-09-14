create function private.has_active_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
  )
$$;

revoke all on function private.has_active_profile() from public, anon;
grant execute on function private.has_active_profile() to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.has_active_profile()
    and coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

alter policy "authenticated users read exams"
on public.exams
using ((select private.has_active_profile()));

alter policy "authenticated users read exam aliases"
on public.exam_aliases
using ((select private.has_active_profile()));

alter policy "authenticated users read exam compositions"
on public.exam_compositions
using ((select private.has_active_profile()));

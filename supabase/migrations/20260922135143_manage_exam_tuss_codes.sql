grant insert, update, delete on table public.exam_tuss_codes to authenticated;

create policy "administrators manage TUSS codes"
on public.exam_tuss_codes for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

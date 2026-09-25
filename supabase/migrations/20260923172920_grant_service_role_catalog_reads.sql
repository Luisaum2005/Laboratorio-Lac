-- The Data API uses least-privilege defaults in this project. Server actions
-- use the service role for catalog matching, so grant read-only access to the
-- catalog relations they query. RLS remains enabled for authenticated users.
grant select on table
  public.exams,
  public.exam_aliases,
  public.exam_compositions,
  public.exam_tuss_codes
to service_role;

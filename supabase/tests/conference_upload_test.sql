begin;
select plan(6);

select has_table('public', 'conferences', 'a tabela de conferências existe');
select is(
  (select public from storage.buckets where id = 'unimed-guides'),
  false,
  'o bucket das fichas é privado'
);
select is(
  (select file_size_limit from storage.buckets where id = 'unimed-guides'),
  10485760::bigint,
  'o bucket limita arquivos a 10 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'unimed-guides'),
  array['application/pdf']::text[],
  'o bucket permite apenas PDF'
);

set local session_replication_role = replica;
insert into public.profiles (user_id, display_name, role)
values
  ('00000000-0000-0000-0000-000000000011', 'Operador um', 'operator'),
  ('00000000-0000-0000-0000-000000000012', 'Operador dois', 'operator');
insert into public.conferences (id, created_by)
values
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000011'),
  ('10000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000012');
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","app_metadata":{"role":"operator"}}';
select is(
  (select count(*) from public.conferences),
  1::bigint,
  'o funcionário consulta somente as próprias conferências'
);
select is_empty(
  $$select id from public.conferences where id = '10000000-0000-4000-8000-000000000012'$$,
  'o funcionário não lê a conferência de outra pessoa'
);

reset role;
select * from finish();
rollback;

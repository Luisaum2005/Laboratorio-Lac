begin;
select plan(5);

select has_table('public', 'exams', 'o catálogo canônico existe');

insert into public.exams (name, mnemonic)
values ('EXAME TESTE CONTROLE DE ACESSO', '__RLS_TEST__');

set local session_replication_role = replica;
insert into public.profiles (user_id, display_name, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Operador de teste', 'operator'),
  ('00000000-0000-0000-0000-000000000002', 'Administrador de teste', 'admin');
set local session_replication_role = origin;

set local role anon;
select throws_ok(
  'select * from public.exams',
  '42501',
  'permission denied for table exams',
  'visitante não consulta o catálogo'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"operator"}}';
select is(
  (select count(*) from public.exams where mnemonic = '__RLS_TEST__'),
  1::bigint,
  'funcionário consulta o catálogo'
);

update public.exams set mnemonic = '__OPERATOR_CHANGED__' where mnemonic = '__RLS_TEST__';
select is(
  (select mnemonic from public.exams where name = 'EXAME TESTE CONTROLE DE ACESSO'),
  '__RLS_TEST__',
  'funcionário não altera o catálogo'
);

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","app_metadata":{"role":"admin"}}';
set local role authenticated;
update public.exams set mnemonic = '__ADMIN_CHANGED__' where mnemonic = '__RLS_TEST__';
select is(
  (select mnemonic from public.exams where name = 'EXAME TESTE CONTROLE DE ACESSO'),
  '__ADMIN_CHANGED__',
  'administrador altera o catálogo'
);

reset role;
select * from finish();
rollback;

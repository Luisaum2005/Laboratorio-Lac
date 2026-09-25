begin;
select plan(6);

select has_table('public', 'exam_tuss_codes', 'o catalogo possui codigos TUSS');
select has_table('public', 'exam_aliases', 'o catalogo possui aliases');
select is(
  (select e.mnemonic from public.exam_tuss_codes as code join public.exams as e on e.id = code.exam_id where code.tuss_code = '40304361'),
  'HM',
  'o TUSS do hemograma aponta para o mnemonico correto'
);
select is(
  (select e.mnemonic from public.exam_tuss_codes as code join public.exams as e on e.id = code.exam_id where code.tuss_code = '40306348'),
  'ATPO',
  'o TUSS do antimicrossomal aponta para o mnemonico correto'
);
select is(
  (select e.mnemonic from public.exam_aliases as alias join public.exams as e on e.id = alias.exam_id where alias.normalized_alias = 'tgo'),
  'TGO',
  'o alias TGO aponta para o exame canonico'
);
select ok(
  has_table_privilege('service_role', 'public.exams', 'select')
  and has_table_privilege('service_role', 'public.exam_aliases', 'select')
  and has_table_privilege('service_role', 'public.exam_compositions', 'select')
  and has_table_privilege('service_role', 'public.exam_tuss_codes', 'select'),
  'o service role pode ler as tabelas usadas na correspondencia do catalogo'
);

select * from finish();
rollback;

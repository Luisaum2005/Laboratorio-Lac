begin;
select plan(16);

insert into public.exams (name, mnemonic)
values
  ('PACOTE CONTROLE GOVERNANCA', '__GOV_PACKAGE__'),
  ('COMPONENTE CONTROLE GOVERNANCA', '__GOV_COMPONENT__'),
  ('OUTRO EXAME CONTROLE GOVERNANCA', '__GOV_OTHER__');

insert into public.exam_aliases (exam_id, alias, normalized_alias)
select id, 'Alias protegido', 'alias protegido'
from public.exams where mnemonic = '__GOV_COMPONENT__';

insert into public.exam_compositions (package_exam_id, component_exam_id)
select package.id, component.id
from public.exams package, public.exams component
where package.mnemonic = '__GOV_PACKAGE__'
  and component.mnemonic = '__GOV_COMPONENT__';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"operator"}}';

select throws_ok(
  $$insert into public.exams (name, mnemonic) values ('NEGADO', '__GOV_DENIED__')$$,
  '42501', null, 'operador não cria exame'
);
select is_empty(
  $$update public.exams set name = 'ALTERADO' where mnemonic = '__GOV_COMPONENT__' returning name$$,
  'operador não edita exame'
);
select is_empty(
  $$delete from public.exams where mnemonic = '__GOV_OTHER__' returning mnemonic$$,
  'operador não desativa nem apaga exame'
);
select throws_ok(
  $$insert into public.exam_aliases (exam_id, alias, normalized_alias)
    select id, 'Negado', 'negado' from public.exams where mnemonic = '__GOV_OTHER__'$$,
  '42501', null, 'operador não aprova alias'
);
select is_empty(
  $$delete from public.exam_aliases where normalized_alias = 'alias protegido' returning alias$$,
  'operador não revoga alias'
);
select throws_ok(
  $$insert into public.exam_compositions (package_exam_id, component_exam_id)
    select package.id, component.id from public.exams package, public.exams component
    where package.mnemonic = '__GOV_PACKAGE__' and component.mnemonic = '__GOV_OTHER__'$$,
  '42501', null, 'operador não adiciona composição'
);
select is_empty(
  $$delete from public.exam_compositions returning package_exam_id$$,
  'operador não remove composição'
);

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","app_metadata":{"role":"admin"}}';
set local role authenticated;

select results_eq(
  $$insert into public.exams (name, mnemonic) values ('NOVO EXAME', '__GOV_NEW__') returning mnemonic$$,
  array['__GOV_NEW__'], 'administrador cria exame'
);
select results_eq(
  $$update public.exams set name = 'COMPONENTE EDITADO' where mnemonic = '__GOV_COMPONENT__' returning name$$,
  array['COMPONENTE EDITADO'], 'administrador edita exame'
);
select results_eq(
  $$update public.exams set active = false where mnemonic = '__GOV_NEW__' returning active$$,
  array[false], 'administrador desativa exame'
);
select results_eq(
  $$insert into public.exam_aliases (exam_id, alias, normalized_alias)
    select id, 'Componente alternativo', 'componente alternativo'
    from public.exams where mnemonic = '__GOV_COMPONENT__' returning alias$$,
  array['Componente alternativo'], 'administrador aprova alias'
);
select is(
  (select name from public.exams where mnemonic = '__GOV_COMPONENT__'),
  'COMPONENTE EDITADO', 'aprovar alias preserva o texto canônico'
);
select throws_ok(
  $$insert into public.exam_aliases (exam_id, alias, normalized_alias)
    select id, 'Alias duplicado', 'componente alternativo'
    from public.exams where mnemonic = '__GOV_OTHER__'$$,
  '23505', null, 'um alias normalizado não aponta para exames diferentes'
);
select results_eq(
  $$delete from public.exam_aliases where normalized_alias = 'componente alternativo' returning alias$$,
  array['Componente alternativo'], 'administrador revoga alias'
);
select results_eq(
  $$insert into public.exam_compositions (package_exam_id, component_exam_id)
    select package.id, component.id from public.exams package, public.exams component
    where package.mnemonic = '__GOV_PACKAGE__' and component.mnemonic = '__GOV_OTHER__'
    returning component_exam_id::text$$,
  $$select id::text from public.exams where mnemonic = '__GOV_OTHER__'$$,
  'administrador adiciona composição explícita'
);
select results_eq(
  $$delete from public.exam_compositions
    where component_exam_id = (select id from public.exams where mnemonic = '__GOV_OTHER__')
    returning component_exam_id::text$$,
  $$select id::text from public.exams where mnemonic = '__GOV_OTHER__'$$,
  'administrador remove composição explícita'
);

reset role;
select * from finish();
rollback;

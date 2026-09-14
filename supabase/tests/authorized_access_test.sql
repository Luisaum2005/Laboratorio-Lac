begin;
select plan(4);

select lives_ok(
  $$insert into public.access_audit_events (action, actor_user_id, target_user_id, target_email, status)
    values ('invited', '00000000-0000-0000-0000-000000000001', null, 'pendente@exemplo.com', 'pending')$$,
  'a intenção de convite pode ser auditada antes de existir o usuário'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"operator"}}';

select throws_ok(
  $$select * from public.access_audit_events$$,
  '42501', null, 'operador não lê eventos de auditoria de acesso'
);
select throws_ok(
  $$insert into public.access_audit_events (action, actor_user_id, target_user_id, target_email)
    values ('invited', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pessoa@exemplo.com')$$,
  '42501', null, 'operador não cria eventos de auditoria'
);
select is(
  (select count(*) from public.exams),
  0::bigint,
  'token sem perfil não lê o catálogo'
);

reset role;
select * from finish();
rollback;

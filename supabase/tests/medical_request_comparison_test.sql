begin;
select plan(4);

select has_table('public', 'conference_medical_request_items', 'os itens do pedido médico são persistidos');
select has_column('public', 'conferences', 'doctor_name', 'a conferência registra o médico solicitante');
select col_not_null('public', 'conferences', 'doctor_is_manual', 'a origem manual do médico é obrigatória');

set local session_replication_role = replica;
insert into public.profiles (user_id, display_name, role)
values ('00000000-0000-0000-0000-000000000091', 'Operador do pedido', 'operator');
insert into public.conferences (id, created_by, doctor_name)
values ('10000000-0000-4000-8000-000000000091', '00000000-0000-0000-0000-000000000091', 'Dra. Ana');
insert into public.exams (id, name, mnemonic)
values (9101, 'HEMOGRAMA COMPLETO', 'HEMOGRAMA')
on conflict (id) do nothing;
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000091","app_metadata":{"role":"operator"}}';
select throws_ok(
  $$insert into public.conference_medical_request_items (conference_id, exam_id, raw_text, created_by)
    values ('10000000-0000-4000-8000-000000000091', 9101, 'Hemograma', '00000000-0000-0000-0000-000000000091')$$,
  '42501', null, 'o funcionário não cria diretamente itens do pedido médico'
);

reset role;
select * from finish();
rollback;

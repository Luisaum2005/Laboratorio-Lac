begin;
select plan(5);

select has_table('public', 'conference_procedure_reviews', 'a tabela de revisão local existe');
select has_column('public', 'conferences', 'procedure_review_completed_at', 'a conferência registra a conclusão da revisão');

set local session_replication_role = replica;
insert into public.profiles (user_id, display_name, role)
values
  ('00000000-0000-0000-0000-000000000031', 'Operador da revisão', 'operator'),
  ('00000000-0000-0000-0000-000000000032', 'Outro operador', 'operator');
insert into public.conferences (id, created_by)
values
  ('10000000-0000-4000-8000-000000000031', '00000000-0000-0000-0000-000000000031'),
  ('10000000-0000-4000-8000-000000000032', '00000000-0000-0000-0000-000000000032');
insert into public.conference_procedure_reviews (
  conference_id, source_index, raw_text, normalized_text, source_page,
  procedure_code, procedure_description, requested_quantity, authorized_quantity,
  is_authorized, resolution
)
values
  ('10000000-0000-4000-8000-000000000031', 0, 'TEXTO UM', 'texto um', 6, '40304361', 'TEXTO UM', 1, 1, true, 'needs_review'),
  ('10000000-0000-4000-8000-000000000032', 0, 'TEXTO DOIS', 'texto dois', 6, '40304362', 'TEXTO DOIS', 1, 1, true, 'needs_review');
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000031","app_metadata":{"role":"operator"}}';

select is(
  (select count(*) from public.conference_procedure_reviews),
  1::bigint,
  'o funcionário lê somente suas revisões locais'
);
select is_empty(
  $$select id from public.conference_procedure_reviews where conference_id = '10000000-0000-4000-8000-000000000032'$$,
  'o funcionário não lê revisões de outra conferência'
);
select throws_ok(
  $$insert into public.conference_procedure_reviews (
      conference_id, source_index, raw_text, normalized_text, source_page,
      procedure_code, procedure_description, requested_quantity, authorized_quantity,
      is_authorized, resolution
    ) values (
      '10000000-0000-4000-8000-000000000031', 1, 'NEGADO', 'negado', 6,
      '40304363', 'NEGADO', 1, 1, true, 'needs_review'
    )$$,
  '42501', null, 'o funcionário não cria revisão diretamente'
);

reset role;
select * from finish();
rollback;

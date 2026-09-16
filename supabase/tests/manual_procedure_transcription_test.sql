begin;
select plan(4);

select has_column('public', 'conference_procedure_reviews', 'entry_origin', 'a revisão registra a origem da entrada');

set local session_replication_role = replica;
insert into public.profiles (user_id, display_name, role)
values ('00000000-0000-0000-0000-000000000081', 'Operador manual', 'operator');
insert into public.conferences (id, created_by)
values ('10000000-0000-4000-8000-000000000081', '00000000-0000-0000-0000-000000000081');
insert into public.exams (id, name, mnemonic)
values (8101, 'HEMOGRAMA COMPLETO', 'HEMOGRAMA')
on conflict (id) do nothing;
set local session_replication_role = origin;

insert into public.conference_procedure_reviews (
  conference_id, source_index, raw_text, normalized_text, source_page,
  procedure_code, procedure_description, requested_quantity, authorized_quantity,
  is_authorized, resolution, resolved_exam_id, entry_origin
) values (
  '10000000-0000-4000-8000-000000000081', 0, 'Hemograma anotado manualmente', 'hemograma anotado manualmente', null,
  null, 'HEMOGRAMA COMPLETO', 2, 1, true, 'confirmed', 8101, 'manual'
);
insert into public.conference_procedure_reviews (
  conference_id, source_index, raw_text, normalized_text, source_page,
  procedure_code, procedure_description, requested_quantity, authorized_quantity,
  is_authorized, resolution, resolved_exam_id
) values (
  '10000000-0000-4000-8000-000000000081', 1, 'Hemograma extraído', 'hemograma extraido', 6,
  '40304361', 'HEMOGRAMA COMPLETO', 1, 1, true, 'confirmed', 8101
);

select is(
  (select entry_origin from public.conference_procedure_reviews where conference_id = '10000000-0000-4000-8000-000000000081' and source_index = 1),
  'extracted'::public.procedure_review_origin,
  'a origem das leituras existentes é extraída'
);
select is(
  (select entry_origin from public.conference_procedure_reviews where conference_id = '10000000-0000-4000-8000-000000000081' and source_index = 0),
  'manual'::public.procedure_review_origin,
  'a transcrição manual fica identificada sem criar um alias'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000081","app_metadata":{"role":"operator"}}';
select throws_ok(
  $$insert into public.conference_procedure_reviews (
      conference_id, source_index, raw_text, normalized_text, source_page,
      procedure_code, procedure_description, requested_quantity, authorized_quantity,
      is_authorized, resolution, resolved_exam_id, entry_origin
    ) values (
      '10000000-0000-4000-8000-000000000081', 1, 'Inserção direta', 'insercao direta', null,
      null, 'HEMOGRAMA COMPLETO', 1, 1, true, 'confirmed', 8101, 'manual'
    )$$,
  '42501', null, 'o funcionário não insere transcrição manual diretamente'
);

reset role;
select * from finish();
rollback;

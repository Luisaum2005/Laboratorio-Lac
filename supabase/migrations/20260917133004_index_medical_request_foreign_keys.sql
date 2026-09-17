create index conference_medical_request_items_exam_id_idx
  on public.conference_medical_request_items (exam_id);

create index conference_medical_request_items_created_by_idx
  on public.conference_medical_request_items (created_by);

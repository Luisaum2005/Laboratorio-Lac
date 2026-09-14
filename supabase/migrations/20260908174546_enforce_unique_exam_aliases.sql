drop index public.exam_aliases_normalized_alias_idx;

alter table public.exam_aliases
  add constraint exam_aliases_normalized_alias_key unique (normalized_alias);

-- Stage 0: deterministic mappings observed in the Unimed guide examples.
-- Ambiguous package/procedure codes remain pending until the laboratory chooses
-- the canonical exam (see docs/stage-0-guide-contract.md).

with tuss_rows(tuss_code, mnemonic) as (
  values
    ('40304361', 'HM'),
    ('40301583', 'HDL'),
    ('40301605', 'COL'),
    ('40302547', 'TRI'),
    ('40302040', 'GLIC'),
    ('40302075', 'HBG'),
    ('40316360', 'INSUL'),
    ('40301150', 'URICO'),
    ('40302504', 'TGO'),
    ('40302512', 'TGP'),
    ('40301990', 'GGT'),
    ('40301885', 'FALC'),
    ('40301397', 'BILI'),
    ('40302580', 'UREIA'),
    ('40301630', 'CREA'),
    ('40302423', 'NA'),
    ('40302318', 'K'),
    ('40301400', 'CALCIO'),
    ('40302237', 'MG'),
    ('40316270', 'FERRIT'),
    ('40302830', 'VITD'),
    ('40316572', 'B12'),
    ('40316491', 'T4L'),
    ('40316521', 'TSH'),
    ('40311210', 'URINA'),
    ('40306852', 'FAN'),
    ('40302733', 'HBG'),
    ('40316467', 'T3L'),
    ('40301842', 'FE'),
    ('40301087', 'FOL'),
    ('40308391', 'PCR'),
    ('40313310', 'CR'),
    ('40306348', 'ATPO'),
    ('40316505', 'TESTOL'),
    ('40316513', 'TESTO'),
    ('40301354', 'APOA'),
    ('40301362', 'APOB')
)
insert into public.exam_tuss_codes (tuss_code, exam_id)
select tuss.tuss_code, exam.id
from tuss_rows as tuss
join public.exams as exam on exam.mnemonic = tuss.mnemonic
on conflict (tuss_code) do update
set exam_id = excluded.exam_id;

with alias_rows(mnemonic, alias, normalized_alias) as (
  values
    ('HM', 'Hemograma', 'hemograma'),
    ('HM', 'Hemograma completo', 'hemograma completo'),
    ('HDL', 'Colesterol HDL', 'colesterol hdl'),
    ('COL', 'Colesterol total', 'colesterol total'),
    ('TRI', 'Triglicerideos', 'triglicerideos'),
    ('GLIC', 'Glicose', 'glicose'),
    ('GLIC', 'Glicemia', 'glicemia'),
    ('GLIC', 'Glicemia de jejum', 'glicemia de jejum'),
    ('HBG', 'Hemoglobina glicada', 'hemoglobina glicada'),
    ('HBG', 'Hemoglobina glicada A1C', 'hemoglobina glicada a1c'),
    ('INSUL', 'Insulina', 'insulina'),
    ('URICO', 'Acido urico', 'acido urico'),
    ('TGO', 'TGO', 'tgo'),
    ('TGO', 'Transaminase oxalacetica', 'transaminase oxalacetica'),
    ('TGP', 'TGP', 'tgp'),
    ('TGP', 'Transaminase piruvica', 'transaminase piruvica'),
    ('GGT', 'Gama GT', 'gama gt'),
    ('GGT', 'Gama glutamil transferase', 'gama glutamil transferase'),
    ('TSH', 'TSH', 'tsh'),
    ('TSH', 'Tireoestimulante', 'tireoestimulante'),
    ('T4L', 'T4 livre', 't4 livre'),
    ('T3L', 'T3 livre', 't3 livre'),
    ('VITD', 'Vitamina D', 'vitamina d'),
    ('B12', 'Vitamina B12', 'vitamina b12'),
    ('CREA', 'Creatinina', 'creatinina'),
    ('MG', 'Magnesio', 'magnesio'),
    ('FE', 'Ferro serico', 'ferro serico'),
    ('FOL', 'Acido folico', 'acido folico'),
    ('UREIA', 'Ureia', 'ureia'),
    ('PCR', 'PCR', 'pcr'),
    ('PCR', 'Proteina C reativa', 'proteina c reativa'),
    ('CR', 'Cromo', 'cromo'),
    ('ATPO', 'ATPO', 'atpo'),
    ('ATPO', 'Antimicrossomal', 'antimicrossomal'),
    ('FAN', 'FAN', 'fan'),
    ('FERRIT', 'Ferritina', 'ferritina'),
    ('NA', 'Sodio', 'sodio'),
    ('K', 'Potassio', 'potassio'),
    ('CALCIO', 'Calcio', 'calcio'),
    ('APOA', 'Apolipoproteina A', 'apolipoproteina a'),
    ('APOB', 'Apolipoproteina B', 'apolipoproteina b'),
    ('TESTOL', 'Testosterona livre', 'testosterona livre'),
    ('TESTO', 'Testosterona total', 'testosterona total'),
    ('PSAL', 'PSA livre', 'psa livre'),
    ('MICALBU', 'Microalbuminuria', 'microalbuminuria')
)
insert into public.exam_aliases (exam_id, alias, normalized_alias)
select exam.id, aliases.alias, aliases.normalized_alias
from alias_rows as aliases
join public.exams as exam on exam.mnemonic = aliases.mnemonic
on conflict (normalized_alias) do nothing;

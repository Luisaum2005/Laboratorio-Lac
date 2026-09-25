# Etapa 0: contrato de dados das guias e pedidos

Este documento registra o contrato observado nos exemplos recebidos e orienta o processamento deterministico. As fotos dos pedidos medicos nao sao interpretadas automaticamente: a atendente seleciona os exames no catalogo e o sistema apenas normaliza, compara e apresenta os mnemonicos.

## Dados da guia Unimed

### Identificacao obrigatoria

- `patient_name`: nome do beneficiario.
- `beneficiary_card_number`: numero da carteira.
- `doctor_name`: profissional ou contratado solicitante. O campo 15 e preferencial; quando estiver vazio, o campo 14 e usado como fallback.
- `doctor_name_source`: `professional` ou `contracted_provider`, para deixar a origem explicita na auditoria.
- `professional_council`, `professional_council_number`, `professional_council_state`: conselho do solicitante, quando disponivel.
- `guide_number`: numero da guia atribuido pela operadora.
- `password`: senha de autorizacao.
- `password_valid_until`: validade da senha.
- `authorization_date`: data da autorizacao.
- `request_date`: data da solicitacao.

### Dados uteis

- `clinical_indication`: indicacao clinica, quando presente.
- `beneficiary_card_valid_until`: validade da carteira.
- pagina de origem do item;
- texto bruto do item;
- codigo TUSS;
- descricao da operadora;
- quantidade solicitada;
- quantidade autorizada;
- `is_authorized`.

Valores financeiros, assinaturas e a secao de execucao nao participam do match. A secao de execucao e o lembrete de solicitacao repetem os procedimentos; o parser deve manter apenas um item por codigo e quantidades.

## Dados do pedido medico

O pedido pode ser uma fotografia, texto digitado ou formulario impresso. A etapa 0 nao exige OCR. Cada item manual deve registrar:

- texto original informado pela atendente;
- exame canonico selecionado no catalogo;
- quantidade;
- medico e data do pedido;
- observacao opcional;
- origem `manual`.

## Regra de identificacao

1. Codigo TUSS unico cadastrado no catalogo.
2. Alias normalizado do nome informado no pedido.
3. Revisao manual quando nao houver correspondencia ou houver mais de uma.

O mnemônico nunca deve ser digitado pela atendente. Ele vem do exame canonico selecionado.

## Casos observados

Os pedidos usam abreviacoes e nomes diferentes da Unimed. O catalogo deve reconhecer, entre outros: Hemograma, Perfil lipidico, TGO, TGP, Gama GT, FAN, TSH, T3 livre, T4 livre, PCR, ATPO, Glicemia de jejum e Acido folico.

Perfil lipidico, BNP, PSA livre, microalbuminuria e algumas composicoes precisam de uma decisao do laboratorio sobre o exame canonico antes de serem associados automaticamente. Enquanto essa decisao nao existir, devem aparecer como pendencia de catalogo, nunca como match silencioso.

## Criterios de aceite

- Guia 1: 25 procedimentos, sem duplicacao.
- Guia 2: 23 procedimentos, sem duplicacao.
- Guia 3: 31 procedimentos, sem duplicacao.
- Metadados principais preenchidos nos tres exemplos.
- Itens divididos entre paginas sao preservados.
- Itens vazios da tabela nao viram procedimentos.
- Um item com codigo TUSS desconhecido fica pendente para revisao.
- Os PDFs reais permanecem fora do repositorio e nao entram nos fixtures automatizados.

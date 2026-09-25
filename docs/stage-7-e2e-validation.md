# Etapa 7 — Validação ponta a ponta

## Escopo

Validar o fluxo da atendente desde a importação da guia Unimed até a geração e o download privado da ficha LAC, incluindo isolamento entre usuários. Esta etapa envolve documentos e dados de saúde: a validação integrada deve usar somente um ambiente de teste confirmado e dados sintéticos.

## Resultado desta execução

**Etapa 7 concluída no ambiente local.** A validação integrada usou Supabase local no Docker, duas contas sintéticas e o PDF anonimizado versionado no repositório. Nenhum dado foi gravado no projeto Supabase remoto.

### Verificações automatizadas

| Camada | Verificação | Resultado |
| --- | --- | --- |
| Aplicação | `pnpm test -- --pool=threads --no-file-parallelism --maxWorkers=1` | Aprovado: 25 arquivos, 90 testes |
| Parser PDF | `python -m unittest discover -s tests -v` em `parser/` | Aprovado: 8 testes; fixture anonimizada e contrato HTTP cobertos |
| Banco local | `supabase test db --local supabase/tests/stage_0_unimed_mappings_test.sql` | Aprovado: 6 verificações pgTAP |
| Produção | `pnpm run build` | Aprovado: compilação, TypeScript e geração das páginas concluídos |
| Configuração de contêineres | `docker compose --env-file .env.local config --services` | Aprovado: configuração reconhece `parser` e `web` |

### Percurso ponta a ponta

| Passo | Evidência observada | Resultado |
| --- | --- | --- |
| Importação | Upload do fixture para `unimed-guides` privado | Aprovado |
| Extração | Paciente, médico, solicitação, número de guia e 3 procedimentos | Aprovado |
| Correspondência | TUSS 40304361 → HEMOGRAMA COMPLETO / HM; 40301583 → COLESTEROL HDL / HDL; 40301605 → COLESTEROL TOTAL / COL | Aprovado |
| Autorização | O fixture contém 2 procedimentos autorizados e 1 não autorizado | Aprovado |
| Pedido manual | HEMOGRAMA COMPLETO e COLESTEROL HDL selecionados no catálogo | Aprovado |
| Comparação | Os dois itens selecionados aparecem como autorizados, sem divergência | Aprovado |
| Finalização | Ficha criada em `lac-forms`, conferência marcada como `finalized` | Aprovado |
| PDF | Download autenticado retornou PDF A4 de 1 página; render revisado visualmente. Inclui paciente sintético, médico, exames e mnemônicos HM/HDL | Aprovado |
| Isolamento | Segunda conta recebeu 404 na conferência e na rota da ficha | Aprovado |
| Bloqueio | Pedido de COLESTEROL TOTAL (COL), marcado como não autorizado, exibiu divergência; confirmação e botão de finalizar ficaram desabilitados | Aprovado |

### Ajuste encontrado durante a validação

A configuração local desabilita a exposição automática das tabelas novas na Data API. O `service_role` não tinha `SELECT` no catálogo, então o primeiro processamento salvou a extração, mas não conseguiu criar as revisões. A migração [20260923172920_grant_service_role_catalog_reads.sql](../supabase/migrations/20260923172920_grant_service_role_catalog_reads.sql) concede somente leitura às quatro tabelas de catálogo consultadas pelo servidor. Foi aplicada apenas ao banco local e coberta por pgTAP. Após o ajuste, os três procedimentos foram persistidos e o fluxo terminou corretamente.

Como o parser em container não consegue baixar URLs assinadas do host que contêm `127.0.0.1`, nesta execução o Supabase permaneceu no Docker e o parser foi executado no host, limitado ao loopback. Nenhuma mudança de código foi necessária para esse contorno de ambiente.

## Estado final

Etapa 7 encerrada com os critérios de aprovação atendidos. Restam **0 etapas** do plano de desenvolvimento atual. Para iniciar um piloto com dados reais, continuam válidas as pendências operacionais do [runbook da etapa 6](stage-6-pilot-runbook.md), especialmente validar um ambiente separado de produção, revisar catálogo/mnemônicos com o laboratório e confirmar retenção e acesso.

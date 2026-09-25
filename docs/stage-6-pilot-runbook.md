# Etapa 6 — Preparação operacional do piloto

## Objetivo

Preparar atendentes e responsáveis do laboratório para um piloto controlado, com instruções de operação, critérios de interrupção e registro de resultados sem copiar dados de pacientes para anotações externas.

## Antes da sessão

O responsável técnico ou administrador confirma cada item:

- [ ] Ambiente de piloto separado de produção e acessível somente a usuários autorizados.
- [ ] Migrações aplicadas e catálogo canônico revisado pelo laboratório.
- [ ] Códigos TUSS e mnemônicos conferidos para os exames incluídos no piloto.
- [ ] Serviço PDF ativo; `PDF_PROCESSOR_URL` aponta para ele e `PDF_PROCESSOR_SHARED_SECRET` está configurado igualmente na aplicação e no parser.
- [ ] Buckets `unimed-guides` e `lac-forms` privados, com limite de 10 MB e acesso por URL assinada curta.
- [ ] Rotina de retenção agendada e executada com sucesso; backups configurados para expirar em até 30 dias.
- [ ] Contas de atendente e administrador testadas; cada papel tem apenas os controles previstos.
- [ ] Atendentes sabem como registrar incidente e interromper o fluxo sem finalizar a conferência.
- [ ] Fixture sintética `parser/tests/fixtures/unimed-guide-anonymized.pdf` disponível para ensaio sem dados reais.

Se qualquer item de segurança, acesso, armazenamento ou retenção não puder ser confirmado, a sessão fica restrita ao fixture sintético.

## Inicialização local do ambiente de ensaio

Configure no `.env.local` um segredo aleatório não vazio em `PDF_PROCESSOR_SHARED_SECRET`. Use o mesmo segredo no processo web e no parser; não o coloque neste documento nem em logs compartilhados. O procedimento abaixo inicia o Supabase local em Docker e executa Next.js e parser PDF no host, configuração validada neste roteiro:

```powershell
pnpm dlx supabase start
$s = pnpm dlx supabase status --output json | ConvertFrom-Json
$env:NEXT_PUBLIC_SUPABASE_URL = $s.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $s.PUBLISHABLE_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $s.SERVICE_ROLE_KEY
$env:PDF_PROCESSOR_URL = 'http://127.0.0.1:8000/parse-guide'
pnpm dev --hostname 127.0.0.1
```

Em outro PowerShell, inicie o parser a partir da pasta `parser`. O segredo é lido do `.env.local` da raiz, sem copiá-lo para o histórico deste documento:

```powershell
$env:PDF_PROCESSOR_SHARED_SECRET = (Get-Content ..\.env.local | Where-Object { $_ -match '^PDF_PROCESSOR_SHARED_SECRET=' } | Select-Object -First 1) -replace '^PDF_PROCESSOR_SHARED_SECRET=', ''
.\.venv\Scripts\python.exe -c "import os; from http.server import ThreadingHTTPServer; from app import create_app; ThreadingHTTPServer(('127.0.0.1', 8000), create_app(os.environ['PDF_PROCESSOR_SHARED_SECRET'])).serve_forever()"
```

O parser escuta somente no loopback da máquina (`127.0.0.1:8000`). Nesta configuração, o host consegue acessar as URLs assinadas do Storage local. Executar o parser dentro de outro container exige configurar uma URL do Supabase acessível de dentro dele: `127.0.0.1` em uma URL assinada aponta para o próprio container, não para o host nem para o container do Supabase.

## Roteiro da atendente

1. Inicie uma conferência e envie a guia PDF. Confira paciente, médico e data extraídos com o documento original.
2. Revise cada procedimento da guia. Use TUSS e mnemônico sugerido pelo catálogo como referência; resolva manualmente toda ambiguidade.
3. Transcreva o pedido médico, informe/corrija o médico e selecione os exames do catálogo. Confira o nome e mnemônico de cada seleção.
4. Compare cada exame do pedido com os itens autorizados. Remova seleções incorretas; não trate como liberado um exame marcado como não autorizado.
5. Leia o resumo e as divergências antes da confirmação operacional. Finalize somente quando os bloqueios forem resolvidos e o resultado corresponder ao documento.
6. Baixe a ficha LAC e confira paciente, médico, datas, exames e mnemônicos. Registre o resultado usando apenas o identificador interno da sessão.

Em caso de leitura indisponível, registre os procedimentos manualmente e faça uma segunda conferência antes de prosseguir.

## Cenários sintéticos de ensaio

| Cenário | Ação esperada | Resultado que deve ser observado |
| --- | --- | --- |
| Guia de texto selecionável | Enviar o fixture anonimizado | Metadados e procedimentos são apresentados para conferência |
| Procedimento reconhecido | Revisar um TUSS cadastrado | A sugestão é ligada ao exame canônico e mnemônico corretos |
| Procedimento desconhecido/ambíguo | Deixar item sem resolução | Finalização permanece bloqueada até revisão explícita |
| Pedido com item autorizado | Selecionar exame que consta autorizado | Comparação mostra autorização e ficha inclui o mnemônico do catálogo |
| Pedido com item não autorizado | Selecionar exame ausente ou não autorizado | Divergência aparece; item não entra em exames liberados |
| Leitura indisponível | Usar entrada manual em ambiente sintético | Nenhum dado é inventado; cada procedimento é transcrito e revisto |
| Acesso a documento final | Baixar como dono da conferência e testar outra conta | Dono consegue baixar; outra conta não obtém acesso |

O fixture existente tem dados de exemplo, não dados de paciente real. Para ensaios de códigos desconhecidos e quantidades não autorizadas, use uma cópia sintética preparada no ambiente de teste; não altere o fixture versionado para simular uma guia clínica real.

## Folha de observação

Uma linha por conferência. Não registre nome, número de carteirinha, senha, número de guia, foto, PDF, texto clínico ou nome do arquivo.

| Sessão | Atendente (código) | Duração (min) | Leitura PDF (sim/não) | Itens revisados | Correções manuais | Divergências | Finalizada (sim/não) | Problema observado (sem texto clínico) |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |
| Exemplo sintético | OP-01 |  |  |  |  |  |  |  |

Compare o tempo com o processo anterior medido para o mesmo tipo de atendimento. Registre também quantas vezes a atendente precisou consultar alguém para identificar um exame ou mnemônico.

## Interromper a sessão quando

- paciente, médico, data, procedimento ou quantidade exibidos não correspondem ao documento;
- exame não autorizado aparece como liberado;
- código TUSS ou mnemônico não corresponde ao catálogo aprovado;
- a ficha final inclui exame que não foi selecionado ou omite exame confirmado;
- um usuário consegue acessar conferência ou arquivo de outra pessoa;
- a guia ou ficha aparece publicamente, em log ou em local não autorizado;
- o serviço de processamento ou a retenção falha sem alternativa operacional aprovada.

Ao interromper, não apague evidências nem compartilhe documentos em canais comuns. Anote o identificador interno da sessão, horário, etapa e comportamento observado; avise o responsável designado. O responsável deve preservar o registro dentro do ambiente autorizado e impedir novas finalizações até a causa ser compreendida.

## Critérios para encerrar o piloto

- Nenhuma divergência de autorização ou acesso indevido observada.
- Cada ficha amostrada confere com o PDF de origem e com os exames selecionados.
- Toda correção de TUSS, exame ou mnemônico é revisada e incorporada ao catálogo por administrador.
- Tempos, consultas a colegas, correções e falhas são comparados com a linha de base do processo atual.
- Responsável do laboratório decide se amplia, ajusta ou encerra o piloto.

## Pendências operacionais antes de dados reais

- Confirmar no provedor a expiração efetiva dos backups em até 30 dias; ver [backup-retention.md](backup-retention.md).
- Confirmar deployment privado e credencial compartilhada do parser em ambos os serviços.
- Confirmar a lista de códigos ambíguos com o laboratório antes de ativar correspondências adicionais.
- Designar responsável pelo piloto e canal autorizado para incidentes.

## Próxima etapa

Executar validação ponta a ponta em um ambiente de teste conectado ao Supabase, cobrindo upload, revisão, comparação, finalização, download e isolamento de acesso. **Concluída localmente**; resultados e ajuste de permissões registrados em [stage-7-e2e-validation.md](stage-7-e2e-validation.md).

# Etapa 4 — Revisão operacional e ficha final LAC

## Objetivo

Dar à atendente uma última conferência explícita antes da emissão, garantindo que a ficha final contenha apenas exames autorizados e os mnemônicos vigentes no catálogo.

## Entregas

- Resumo visual dos exames do pedido médico antes da finalização.
- Divergências destacadas individualmente, sem esconder os itens já informados.
- Extras autorizados podem ser escolhidos explicitamente.
- Finalização bloqueada para pendência da guia, pedido vazio, exame não autorizado ou falta de confirmação.
- PDF final com paciente, médico, datas, guia, senha, exames liberados, extras e divergências.
- PDF armazenado em bucket privado, com download autorizado apenas ao atendente dono da conferência.
- Paginação automática e rodapé com página atual/total.

## Critérios de aceite

1. Nenhum exame não autorizado entra na seção de exames liberados.
2. O mnemônico da ficha é sempre o valor do catálogo canônico.
3. A atendente visualiza divergências antes de marcar a confirmação operacional.
4. A ficha pode ser baixada novamente sem tornar o arquivo público.
5. Listas grandes quebram em novas páginas sem cortar textos ou o rodapé.

## Próxima etapa

Adicionar auditoria operacional, revisão de segurança/retenção e preparação do piloto com métricas de tempo, divergências e correções manuais.

# Etapa 3 — Pedido médico manual e comparação

## Objetivo

Registrar pedidos médicos fotografados ou impressos sem OCR: a atendente transcreve o texto de referência, informa o médico e seleciona os exames canônicos do catálogo.

## Entregas

- Campo de texto amplo para transcrição do pedido.
- Seleção de um ou mais exames canônicos, sempre exibindo nome e mnemônico.
- Comparação imediata de cada exame selecionado com os itens autorizados da guia.
- Situação explícita: `Autorizado pela guia` ou `Não autorizado pela guia`.
- Remoção individual de exames selecionados para corrigir a transcrição sem apagar o pedido inteiro.
- A lista de exames continua visível mesmo quando a guia ainda possui itens pendentes de revisão.
- O médico informado no pedido permanece marcado como entrada manual e pode substituir o valor extraído do PDF.

## Critérios de aceite

1. A atendente consegue registrar vários exames de uma vez.
2. Cada item salvo mostra o exame canônico, o mnemônico e o resultado da comparação.
3. Um exame não autorizado não pode ser tratado como liberado na finalização.
4. A atendente consegue corrigir uma seleção removendo apenas o item errado.
5. A existência de uma pendência na guia bloqueia a finalização, mas não esconde o que já foi informado no pedido.

## Próxima etapa

Fechar a revisão operacional e a geração da ficha final LAC, com divergências destacadas e mnemônicos vindos exclusivamente do catálogo.

# Etapa 1 — Catálogo canônico e governança TUSS

## Objetivo

Garantir que cada exame usado no fluxo tenha um registro canônico, um mnemônico do laboratório e, quando conhecido, um código TUSS associado. A guia final deve consultar esse catálogo em vez de depender da memória da atendente.

## Entregas

- A tela de detalhes do catálogo exibe os códigos TUSS associados ao exame.
- Administradores podem associar ou revogar um TUSS por formulário.
- O código é validado no domínio como exatamente oito dígitos antes de qualquer gravação.
- Operadores podem consultar os códigos, mas não recebem controles de alteração.
- A gravação usa `exam_tuss_codes`, com unicidade e validações também protegidas pelo banco/RLS.
- Mensagens de sucesso e erro retornam para a tela do exame após cada mutação.

## Critérios de aceite

1. Dado um exame existente, o administrador consegue associar um código TUSS válido.
2. Um código com formato inválido não gera chamada ao banco.
3. O administrador consegue revogar somente o código selecionado.
4. O operador consulta os códigos sem botões, campos ou selects de mutação.
5. Um TUSS sem correspondência canônica permanece pendente para decisão do laboratório; o sistema não inventa mnemônicos.

## Próxima etapa

Implementar a importação da guia PDF e a fila de conferência que usa o código TUSS como primeira chave de correspondência, deixando descrições ambíguas para confirmação explícita.

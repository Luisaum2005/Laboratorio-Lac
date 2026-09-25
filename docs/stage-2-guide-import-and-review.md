# Etapa 2 — Importação da guia e conferência da leitura

## Objetivo

Permitir que a atendente envie a guia Unimed em PDF e enxergue, em uma única tela, os dados essenciais extraídos antes de comparar os exames com o pedido médico.

## Entregas

- A tela reconhece quando a leitura terminou e deixa de exibir o estado enganoso de “processando”.
- Paciente, médico solicitante, data da solicitação, número da guia e indicação clínica são apresentados quando encontrados.
- A origem dos dados é identificada como o PDF; essa leitura não altera o catálogo canônico.
- O parser determinístico continua extraindo procedimentos, quantidades e autorização.
- A fila de revisão usa TUSS primeiro e alias exato como fallback; correspondências ambíguas ficam pendentes.
- PDFs inválidos, grandes ou fora do limite de páginas continuam preservando o rascunho.

## Critérios de aceite

1. Após o parser retornar `status: ok`, a conferência exibe “Leitura concluída” e os metadados disponíveis.
2. O nome do paciente, médico e data podem ser conferidos sem abrir o arquivo original.
3. Um resultado `reading_unavailable` não inventa dados e direciona a atendente para a transcrição manual dos procedimentos.
4. Um procedimento sem correspondência única permanece em revisão e impede a finalização automática.

## Validação com os exemplos recebidos

Os três PDFs locais (`Guia_1.pdf`, `Guia_2.pdf` e `Guia_3.pdf`) foram lidos pelo parser sem IA e retornaram `status: ok`, com paciente, médico, data, número da guia e procedimentos identificados.

## Próxima etapa

Construir a entrada estruturada do pedido médico (foto, texto ou formulário), com seleção manual dos exames e comparação visual contra os itens autorizados da guia.

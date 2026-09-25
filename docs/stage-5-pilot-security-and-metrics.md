# Etapa 5 — Segurança, retenção e indicadores do piloto

## Objetivo

Preparar o sistema para uso controlado com dados reais, mantendo documentos privados, expurgando dados clínicos vencidos e permitindo avaliar se o fluxo está reduzindo retrabalho.

## Entregas

- Retenção operacional e auditoria de expurgo preservadas.
- Auditoria de convites e revogações de acesso preservada.
- Indicadores agregados dos últimos 30 dias no painel administrativo.
- Métricas exibidas: volume, finalizações, conferências em andamento, guias lidas, correções manuais do médico e tempo mediano até finalizar.
- Nenhum nome de paciente, documento ou texto clínico é exposto no painel de métricas.

## Critérios de aceite

1. Conferências vencidas podem ser expurgadas de forma idempotente.
2. Falhas de expurgo ficam registradas para retomada.
3. Apenas administradores acessam auditoria e métricas.
4. O cálculo do piloto não depende de IA nem altera os registros clínicos.
5. A retenção de backups segue limitada a 30 dias antes da produção.

## Próxima etapa

Preparar roteiro operacional, checklist de prontidão, cenários sintéticos e folha de observação sem dados de pacientes. O piloto com dados reais depende da confirmação das configurações do ambiente e do responsável do laboratório.

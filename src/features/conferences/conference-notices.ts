const errorMessages: Record<string, string> = {
  not_pdf: "Envie a ficha em formato PDF.",
  too_large: "O PDF deve ter no máximo 10 MB.",
  invalid_pdf: "Não foi possível validar este PDF. Escolha outro arquivo ou confira a ficha manualmente.",
  too_many_pages: "O PDF deve ter no máximo 10 páginas.",
  upload_failed: "Não foi possível enviar o arquivo agora. Seu rascunho foi preservado; tente novamente.",
  upload_record_failed: "O arquivo foi enviado, mas não foi possível vinculá-lo ao rascunho. Tente novamente.",
  processing_unavailable: "O arquivo foi preservado, mas não foi possível iniciar o processamento. Tente novamente.",
  review_invalid: "Selecione um exame canônico válido antes de confirmar o item.",
  review_update_failed: "Não foi possível salvar a revisão do procedimento. Tente novamente.",
  review_approval_blocked: "A aprovação foi bloqueada. Veja os procedimentos sinalizados na revisão e corrija ou exclua os itens irregulares.",
  review_approval_failed: "Não foi possível aprovar os exames agora. Nenhuma aprovação foi concluída; tente novamente.",
  medical_request_invalid: "Selecione ao menos um exame ativo do catálogo.",
  medical_request_save_failed: "Não foi possível salvar o exame do pedido médico. Tente novamente.",
  finalization_pending_review: "Conclua a revisão dos procedimentos da guia antes de finalizar.",
  finalization_not_authorized: "Há exame do pedido médico sem autorização na guia.",
  finalization_confirmation_required: "Confirme que revisou exames e divergências antes de finalizar.",
  finalization_unavailable: "Esta conferência já foi finalizada ou não pode ser finalizada agora.",
  finalization_failed: "Não foi possível gerar a ficha LAC. Tente novamente.",
  not_found: "Esta conferência não está disponível para o seu acesso.",
  delete_failed: "Não foi possível excluir a conferência por completo. O registro técnico foi preservado para verificação; tente novamente ou solicite apoio ao administrador.",
};

export function conferenceNotice(query: { success?: string; error?: string }) {
  if (query.success === "deleted") {
    return { tone: "success" as const, message: "Conferência excluída. Os PDFs e os dados identificáveis foram removidos; a auditoria técnica foi preservada." };
  }
  if (query.success === "processing") {
    return { tone: "success" as const, message: "Arquivo enviado com segurança. O processamento foi iniciado." };
  }
  if (query.success === "review_updated") {
    return { tone: "success" as const, message: "A revisão local do procedimento foi salva." };
  }
  if (query.success === "review_approved") {
    return { tone: "success" as const, message: "Exames regulares aprovados em lote e revisão registrada." };
  }
  if (query.success === "medical_request_saved") {
    return { tone: "success" as const, message: "O exame do pedido médico foi salvo e comparado com a guia Unimed." };
  }
  if (query.success === "medical_request_removed") {
    return { tone: "success" as const, message: "O exame foi removido do pedido médico." };
  }
  if (query.success === "finalized") {
    return { tone: "success" as const, message: "Conferência finalizada e ficha LAC gerada com sucesso." };
  }
  if (query.success === "awaiting_processing") {
    return { tone: "success" as const, message: "Arquivo enviado com segurança e aguardando o processamento." };
  }

  if (typeof query.error === "string" && Object.hasOwn(errorMessages, query.error)) {
    return { tone: "error" as const, message: errorMessages[query.error] };
  }

  return undefined;
}

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
  not_found: "Esta conferência não está disponível para o seu acesso.",
};

export function conferenceNotice(query: { success?: string; error?: string }) {
  if (query.success === "processing") {
    return { tone: "success" as const, message: "Arquivo enviado com segurança. O processamento foi iniciado." };
  }
  if (query.success === "review_updated") {
    return { tone: "success" as const, message: "A revisão local do procedimento foi salva." };
  }
  if (query.success === "awaiting_processing") {
    return { tone: "success" as const, message: "Arquivo enviado com segurança e aguardando o processamento." };
  }

  if (typeof query.error === "string" && Object.hasOwn(errorMessages, query.error)) {
    return { tone: "error" as const, message: errorMessages[query.error] };
  }

  return undefined;
}

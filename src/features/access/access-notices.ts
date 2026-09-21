const successMessages: Record<string, string> = {
  invited: "Convite enviado para o e-mail autorizado.",
  revoked: "Acesso revogado.",
  retention: "A retenção foi reprocessada.",
};

const errorMessages: Record<string, string> = {
  invalid: "Revise os dados informados e tente novamente.",
  error: "Não foi possível concluir a alteração. Atualize a página e tente novamente.",
  retention: "Não foi possível reprocessar a retenção. Tente novamente.",
};

export function accessNotice(query: { success?: string; error?: string }) {
  if (query.success && Object.hasOwn(successMessages, query.success)) {
    return { tone: "success" as const, message: successMessages[query.success] };
  }
  if (query.error && Object.hasOwn(errorMessages, query.error)) {
    return { tone: "error" as const, message: errorMessages[query.error] };
  }
  return undefined;
}

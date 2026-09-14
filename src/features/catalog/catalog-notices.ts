const successMessages: Record<string, string> = {
  "exam-created": "Exame adicionado ao catálogo.",
  "exam-updated": "Exame atualizado.",
  "exam-deactivated": "Exame desativado.",
  "alias-approved": "Alias aprovado.",
  "alias-revoked": "Alias revogado.",
  "component-added": "Componente adicionado ao pacote.",
  "component-removed": "Componente removido do pacote.",
};

const errorMessages: Record<string, string> = {
  forbidden: "Seu usuário não possui permissão administrativa.",
  invalid: "Revise os campos obrigatórios e tente novamente.",
  error: "Não foi possível concluir a alteração. O registro pode não existir, já ter sido alterado ou conter dados duplicados. Atualize a página e tente novamente.",
};

export function catalogNotice(query: { success?: string; error?: string }) {
  if (query.success && Object.hasOwn(successMessages, query.success)) {
    return { tone: "success" as const, message: successMessages[query.success] };
  }
  if (query.error && Object.hasOwn(errorMessages, query.error)) {
    return { tone: "error" as const, message: errorMessages[query.error] };
  }
  return undefined;
}

const successMessages: Record<string, string> = {
  "exam-created": "Exame adicionado ao catálogo.",
  "exam-updated": "Exame atualizado.",
  "exam-deactivated": "Exame desativado.",
  "alias-approved": "Alias aprovado.",
  "alias-revoked": "Alias revogado.",
  "component-added": "Componente adicionado ao pacote.",
  "component-removed": "Componente removido do pacote.",
  "tuss-added": "Código TUSS associado ao exame.",
  "tuss-revoked": "Código TUSS removido.",
};

const errorMessages: Record<string, string> = {
  forbidden: "Seu usuário não possui permissão administrativa.",
  invalid: "Revise os campos obrigatórios e tente novamente.",
  error: "Não foi possível concluir a alteração. O registro pode não existir, já ter sido alterado ou conter dados duplicados. Atualize a página e tente novamente.",
  "mnemonic-import-file-required": "Selecione uma planilha .xls ou .xml válida.",
  "mnemonic-import-too-large": "A planilha deve ter no máximo 800 KB.",
  "mnemonic-import-invalid-format": "A planilha não corresponde ao formato esperado. Use as colunas Mnemônico e Descrição.",
  "mnemonic-import-invalid-row": "Há uma linha com mnemônico ou descrição em branco. Corrija a planilha e tente novamente.",
  "mnemonic-import-duplicate": "A planilha tem o mesmo mnemônico associado a descrições diferentes. Corrija a duplicidade antes de importar.",
  "mnemonic-import-confirmation-required": "Confirme a atualização do catálogo antes de importar a planilha.",
  "mnemonic-import-failed": "Não foi possível importar a planilha. Nenhuma alteração foi confirmada. Atualize a página e tente novamente.",
};

export function catalogNotice(query: { success?: string; error?: string; added?: string; updated?: string; unchanged?: string }) {
  if (query.success && Object.hasOwn(successMessages, query.success)) {
    return { tone: "success" as const, message: successMessages[query.success] };
  }
  if (query.success === "mnemonics-imported") {
    const count = (value: string | undefined) => {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : 0;
    };
    return { tone: "success" as const, message: `Planilha importada: ${count(query.added)} novos, ${count(query.updated)} atualizados e ${count(query.unchanged)} sem alteração.` };
  }
  if (query.error && Object.hasOwn(errorMessages, query.error)) {
    return { tone: "error" as const, message: errorMessages[query.error] };
  }
  return undefined;
}

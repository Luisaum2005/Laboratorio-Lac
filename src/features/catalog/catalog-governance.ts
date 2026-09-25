export type CatalogMutationResult =
  | { status: "success" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

export type CatalogGovernanceGateway = {
  insertExam(input: { name: string; mnemonic: string }): Promise<{ error: string | null }>;
  updateExam(
    id: string,
    input: { name: string; mnemonic: string },
  ): Promise<{ error: string | null }>;
  deactivateExam(id: string): Promise<{ error: string | null }>;
  insertAlias(
    examId: string,
    input: { alias: string; normalizedAlias: string },
  ): Promise<{ error: string | null }>;
  deleteAlias(aliasId: string): Promise<{ error: string | null }>;
  insertTussCode(examId: string, code: string): Promise<{ error: string | null }>;
  deleteTussCode(code: string): Promise<{ error: string | null }>;
  insertComposition(input: {
    packageExamId: string;
    componentExamId: string;
  }): Promise<{ error: string | null }>;
  deleteComposition(input: {
    packageExamId: string;
    componentExamId: string;
  }): Promise<{ error: string | null }>;
};

function normalizeCanonicalExamInput(input: { name: string; mnemonic: string }) {
  return {
    name: input.name.trim(),
    mnemonic: input.mnemonic.trim().toLocaleUpperCase("pt-BR"),
  };
}

export async function createCanonicalExam(
  input: { name: string; mnemonic: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const { name, mnemonic } = normalizeCanonicalExamInput(input);

  if (!name || !mnemonic) {
    return { status: "invalid", message: "Nome e mnemônico são obrigatórios." };
  }

  const { error } = await gateway.insertExam({ name, mnemonic });
  return error
    ? { status: "error", message: "Não foi possível adicionar o exame." }
    : { status: "success" };
}

export async function removeComposition(
  input: { packageExamId: string; componentExamId: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const packageExamId = input.packageExamId.trim();
  const componentExamId = input.componentExamId.trim();
  if (!packageExamId || !componentExamId) {
    return { status: "invalid", message: "Pacote e componente são obrigatórios." };
  }

  const { error } = await gateway.deleteComposition({ packageExamId, componentExamId });
  return error
    ? { status: "error", message: "Não foi possível remover o componente." }
    : { status: "success" };
}

export async function addComposition(
  input: { packageExamId: string; componentExamId: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const packageExamId = input.packageExamId.trim();
  const componentExamId = input.componentExamId.trim();

  if (!packageExamId || !componentExamId || packageExamId === componentExamId) {
    return {
      status: "invalid",
      message: "Pacote e componente devem ser exames diferentes.",
    };
  }

  const { error } = await gateway.insertComposition({ packageExamId, componentExamId });
  return error
    ? { status: "error", message: "Não foi possível adicionar o componente." }
    : { status: "success" };
}

export async function revokeAlias(
  aliasId: string,
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const id = aliasId.trim();
  if (!id) return { status: "invalid", message: "Alias é obrigatório." };

  const { error } = await gateway.deleteAlias(id);
  return error
    ? { status: "error", message: "Não foi possível revogar o alias." }
    : { status: "success" };
}

export async function addTussCode(
  input: { examId: string; code: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const examId = input.examId.trim();
  const code = input.code.trim();
  if (!examId || !/^\d{8}$/.test(code)) {
    return { status: "invalid", message: "Informe um código TUSS com oito dígitos." };
  }

  const { error } = await gateway.insertTussCode(examId, code);
  return error
    ? { status: "error", message: "Não foi possível adicionar o código TUSS." }
    : { status: "success" };
}

export async function revokeTussCode(
  code: string,
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const normalizedCode = code.trim();
  if (!/^\d{8}$/.test(normalizedCode)) {
    return { status: "invalid", message: "Informe um código TUSS válido." };
  }

  const { error } = await gateway.deleteTussCode(normalizedCode);
  return error
    ? { status: "error", message: "Não foi possível revogar o código TUSS." }
    : { status: "success" };
}

export async function approveAlias(
  input: { examId: string; alias: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const examId = input.examId.trim();
  const alias = input.alias.trim();
  const normalizedAlias = alias
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!examId || !alias || !normalizedAlias) {
    return { status: "invalid", message: "Exame e alias são obrigatórios." };
  }

  const { error } = await gateway.insertAlias(examId, { alias, normalizedAlias });
  return error
    ? { status: "error", message: "Não foi possível aprovar o alias." }
    : { status: "success" };
}

export async function deactivateCanonicalExam(
  examId: string,
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const id = examId.trim();
  if (!id) return { status: "invalid", message: "Exame é obrigatório." };

  const { error } = await gateway.deactivateExam(id);
  return error
    ? { status: "error", message: "Não foi possível desativar o exame." }
    : { status: "success" };
}

export async function updateCanonicalExam(
  input: { id: string; name: string; mnemonic: string },
  gateway: CatalogGovernanceGateway,
): Promise<CatalogMutationResult> {
  const id = input.id.trim();
  const { name, mnemonic } = normalizeCanonicalExamInput(input);

  if (!id || !name || !mnemonic) {
    return { status: "invalid", message: "Exame, nome e mnemônico são obrigatórios." };
  }

  const { error } = await gateway.updateExam(id, { name, mnemonic });
  return error
    ? { status: "error", message: "Não foi possível atualizar o exame." }
    : { status: "success" };
}

import { describe, expect, it, vi } from "vitest";

import {
  addComposition,
  addTussCode,
  approveAlias,
  createCanonicalExam,
  deactivateCanonicalExam,
  revokeAlias,
  revokeTussCode,
  removeComposition,
  type CatalogGovernanceGateway,
  updateCanonicalExam,
} from "./catalog-governance";

describe("governança do catálogo", () => {
  it("cria um exame canônico com nome limpo e mnemônico em maiúsculas", async () => {
    const insertExam = vi.fn().mockResolvedValue({ error: null });
    const gateway = { insertExam } as unknown as CatalogGovernanceGateway;

    const result = await createCanonicalExam(
      { name: "  Hemograma completo  ", mnemonic: " hm " },
      gateway,
    );

    expect(result).toEqual({ status: "success" });
    expect(insertExam).toHaveBeenCalledWith({
      name: "Hemograma completo",
      mnemonic: "HM",
    });
  });

  it("edita o nome e o mnemônico de um exame canônico", async () => {
    const updateExam = vi.fn().mockResolvedValue({ error: null });
    const gateway = { updateExam } as unknown as CatalogGovernanceGateway;

    const result = await updateCanonicalExam(
      { id: "42", name: " Glicemia de jejum ", mnemonic: " glic " },
      gateway,
    );

    expect(result).toEqual({ status: "success" });
    expect(updateExam).toHaveBeenCalledWith("42", {
      name: "Glicemia de jejum",
      mnemonic: "GLIC",
    });
  });

  it("desativa um exame sem apagar o registro canônico", async () => {
    const deactivateExam = vi.fn().mockResolvedValue({ error: null });
    const gateway = { deactivateExam } as unknown as CatalogGovernanceGateway;

    const result = await deactivateCanonicalExam("42", gateway);

    expect(result).toEqual({ status: "success" });
    expect(deactivateExam).toHaveBeenCalledWith("42");
  });

  it("aprova um alias preservando o texto informado e uma chave normalizada", async () => {
    const insertAlias = vi.fn().mockResolvedValue({ error: null });
    const gateway = { insertAlias } as unknown as CatalogGovernanceGateway;

    const result = await approveAlias(
      { examId: "42", alias: "  Ácido úrico / urina  " },
      gateway,
    );

    expect(result).toEqual({ status: "success" });
    expect(insertAlias).toHaveBeenCalledWith("42", {
      alias: "Ácido úrico / urina",
      normalizedAlias: "acido urico urina",
    });
  });

  it("revoga somente o alias selecionado", async () => {
    const deleteAlias = vi.fn().mockResolvedValue({ error: null });
    const gateway = { deleteAlias } as unknown as CatalogGovernanceGateway;

    const result = await revokeAlias("alias-9", gateway);

    expect(result).toEqual({ status: "success" });
    expect(deleteAlias).toHaveBeenCalledWith("alias-9");
  });

  it("adiciona somente a composição explícita selecionada pelo administrador", async () => {
    const insertComposition = vi.fn().mockResolvedValue({ error: null });
    const gateway = { insertComposition } as unknown as CatalogGovernanceGateway;

    const result = await addComposition(
      { packageExamId: "42", componentExamId: "7" },
      gateway,
    );

    expect(result).toEqual({ status: "success" });
    expect(insertComposition).toHaveBeenCalledWith({
      packageExamId: "42",
      componentExamId: "7",
    });
  });

  it("remove somente a composição explícita selecionada", async () => {
    const deleteComposition = vi.fn().mockResolvedValue({ error: null });
    const gateway = { deleteComposition } as unknown as CatalogGovernanceGateway;

    const result = await removeComposition(
      { packageExamId: "42", componentExamId: "7" },
      gateway,
    );

    expect(result).toEqual({ status: "success" });
    expect(deleteComposition).toHaveBeenCalledWith({
      packageExamId: "42",
      componentExamId: "7",
    });
  });

  it("adiciona somente códigos TUSS válidos ao exame", async () => {
    const insertTussCode = vi.fn().mockResolvedValue({ error: null });
    const gateway = { insertTussCode } as unknown as CatalogGovernanceGateway;

    const result = await addTussCode({ examId: "42", code: " 40304361 " }, gateway);

    expect(result).toEqual({ status: "success" });
    expect(insertTussCode).toHaveBeenCalledWith("42", "40304361");
  });

  it("recusa código TUSS fora do formato de oito dígitos", async () => {
    const insertTussCode = vi.fn();
    const gateway = { insertTussCode } as unknown as CatalogGovernanceGateway;

    const result = await addTussCode({ examId: "42", code: "TUSS" }, gateway);

    expect(result).toEqual({ status: "invalid", message: "Informe um código TUSS com oito dígitos." });
    expect(insertTussCode).not.toHaveBeenCalled();
  });

  it("revoga somente o código TUSS selecionado", async () => {
    const deleteTussCode = vi.fn().mockResolvedValue({ error: null });
    const gateway = { deleteTussCode } as unknown as CatalogGovernanceGateway;

    const result = await revokeTussCode("40304361", gateway);

    expect(result).toEqual({ status: "success" });
    expect(deleteTussCode).toHaveBeenCalledWith("40304361");
  });
});

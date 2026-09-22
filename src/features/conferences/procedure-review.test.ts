import { describe, expect, it } from "vitest";

import { isProcedureReviewComplete, normalizeProcedureText, resolveExtractedProcedures } from "./procedure-review";

describe("revisão dos procedimentos extraídos", () => {
  it("normaliza caixa, acentos, pontuação, espaços e separadores de modo determinístico", () => {
    expect(normalizeProcedureText("  Ácido-Úrico / URINA  ")).toBe("acido urico urina");
  });

  it("aceita automaticamente um alias exato e expande apenas a composição explícita", () => {
    const reviews = resolveExtractedProcedures(
      [{ rawText: "40304361 - Hemograma completo 1 1", page: 6, code: "40304361", description: "HEMOGRAMA  COMPLETO", requestedQuantity: 1, authorizedQuantity: 1, isAuthorized: true }],
      {
        aliases: [{ examId: "10", normalizedAlias: "hemograma completo" }],
        tussCodes: [],
        compositions: [{ packageExamId: "10", componentExamId: "11" }],
      },
    );

    expect(reviews).toEqual([{
      sourceIndex: 0,
      rawText: "40304361 - Hemograma completo 1 1",
      page: 6,
      code: "40304361",
      description: "HEMOGRAMA  COMPLETO",
      requestedQuantity: 1,
      authorizedQuantity: 1,
      isAuthorized: true,
      normalizedText: "hemograma completo",
      resolution: "auto_matched",
      matchedExamId: "10",
      resolvedExamId: "10",
      expandedExamIds: ["11"],
    }]);
  });

  it("preserva texto bruto e exige revisão quando não há alias único", () => {
    const reviews = resolveExtractedProcedures(
      [{ rawText: "99999999 - Texto desconhecido 1 1", page: 6, code: "99999999", description: "Texto desconhecido", requestedQuantity: 1, authorizedQuantity: 1, isAuthorized: true }],
      { aliases: [], tussCodes: [], compositions: [] },
    );

    expect(reviews[0]).toMatchObject({
      rawText: "99999999 - Texto desconhecido 1 1",
      normalizedText: "texto desconhecido",
      resolution: "needs_review",
      matchedExamId: null,
      resolvedExamId: null,
      expandedExamIds: [],
    });
  });

  it("prioriza o código TUSS explícito sobre a descrição variável da guia", () => {
    const [review] = resolveExtractedProcedures(
      [{ rawText: "40304361 HEMOGRAMA COM CONTAGEM 1 1", page: 1, code: "40304361", description: "HEMOGRAMA COM CONTAGEM", requestedQuantity: 1, authorizedQuantity: 1, isAuthorized: true }],
      { aliases: [], tussCodes: [{ examId: "10", code: "40304361" }], compositions: [] },
    );
    expect(review).toMatchObject({ resolution: "auto_matched", matchedExamId: "10", resolvedExamId: "10" });
  });

  it("exige revisão quando mais de um alias normalizado é apresentado", () => {
    const reviews = resolveExtractedProcedures(
      [{ rawText: "40304361 - Hemograma 1 1", page: 6, code: "40304361", description: "Hemograma", requestedQuantity: 1, authorizedQuantity: 1, isAuthorized: true }],
      {
        aliases: [
          { examId: "10", normalizedAlias: "hemograma" },
          { examId: "11", normalizedAlias: "hemograma" },
        ],
        tussCodes: [],
        compositions: [],
      },
    );

    expect(reviews[0]).toMatchObject({ resolution: "needs_review", matchedExamId: null, resolvedExamId: null });
  });

  it("bloqueia o avanço enquanto algum item exige revisão", () => {
    expect(isProcedureReviewComplete([{ resolution: "auto_matched" }, { resolution: "needs_review" }])).toBe(false);
    expect(isProcedureReviewComplete([{ resolution: "confirmed" }, { resolution: "excluded" }])).toBe(true);
  });
});

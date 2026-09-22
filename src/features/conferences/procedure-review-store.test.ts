import { describe, expect, it, vi } from "vitest";

import { persistInitialProcedureReviews, type ProcedureReviewStoreGateway } from "./procedure-review-store";

describe("persistência da revisão de procedimentos", () => {
  it("cria revisões locais a partir do alias exato sem tocar no catálogo", async () => {
    const saveInitialReviews = vi.fn().mockResolvedValue({ error: null });
    const gateway: ProcedureReviewStoreGateway = {
      countReviews: vi.fn().mockResolvedValue({ count: 0, error: null }),
      listAliases: vi.fn().mockResolvedValue({ aliases: [{ examId: "10", normalizedAlias: "hemograma completo" }], error: null }),
      listTussCodes: vi.fn().mockResolvedValue({ tussCodes: [], error: null }),
      listCompositions: vi.fn().mockResolvedValue({ compositions: [], error: null }),
      saveInitialReviews,
    };

    const result = await persistInitialProcedureReviews("conference-1", [{
      rawText: "40304361 - Hemograma completo 1 1",
      page: 6,
      code: "40304361",
      description: "Hemograma completo",
      requestedQuantity: 1,
      authorizedQuantity: 1,
      isAuthorized: true,
    }], gateway);

    expect(result).toEqual({ status: "success" });
    expect(saveInitialReviews).toHaveBeenCalledWith("conference-1", [expect.objectContaining({
      resolution: "auto_matched",
      matchedExamId: "10",
      resolvedExamId: "10",
    })]);
  });

  it("preserva uma correção local existente em vez de substituir a revisão", async () => {
    const saveInitialReviews = vi.fn();
    const gateway = {
      countReviews: vi.fn().mockResolvedValue({ count: 1, error: null }),
      listAliases: vi.fn(),
      listCompositions: vi.fn(),
      saveInitialReviews,
    } as unknown as ProcedureReviewStoreGateway;

    const result = await persistInitialProcedureReviews("conference-1", [], gateway);

    expect(result).toEqual({ status: "success" });
    expect(saveInitialReviews).not.toHaveBeenCalled();
  });
});

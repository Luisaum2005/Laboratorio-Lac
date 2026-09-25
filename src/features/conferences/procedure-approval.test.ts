import { describe, expect, it } from "vitest";

import { findProcedureApprovalIssues } from "./procedure-approval";
import type { ConferenceProcedureReviewDisplay } from "./procedure-review-page";

const regularReview: ConferenceProcedureReviewDisplay = {
  id: "review-1",
  rawText: "Hemograma",
  page: 1,
  code: "40304361",
  description: "Hemograma completo",
  requestedQuantity: 1,
  authorizedQuantity: 1,
  isAuthorized: true,
  resolution: "auto_matched",
  matchedExamId: "10",
  resolvedExamId: "10",
};

describe("validação da aprovação em lote dos procedimentos", () => {
  it("aponta autorização negada e diferença entre quantidade solicitada e autorizada", () => {
    const issues = findProcedureApprovalIssues([{
      ...regularReview,
      isAuthorized: false,
      requestedQuantity: 2,
      authorizedQuantity: 1,
    }]);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.reason)).toEqual([
      "Consta como não autorizado na guia Unimed.",
      "Quantidade divergente: 2 solicitada e 1 autorizada.",
    ]);
  });

  it("não bloqueia uma linha explicitamente excluída quando há outro exame regular", () => {
    expect(findProcedureApprovalIssues([
      { ...regularReview, id: "review-excluded", resolution: "excluded", resolvedExamId: null },
      regularReview,
    ])).toEqual([]);
  });

  it("não permite aprovar quando todos os procedimentos foram excluídos", () => {
    expect(findProcedureApprovalIssues([
      { ...regularReview, resolution: "excluded", resolvedExamId: null },
    ])).toMatchObject([{ description: "Nenhum procedimento" }]);
  });
});

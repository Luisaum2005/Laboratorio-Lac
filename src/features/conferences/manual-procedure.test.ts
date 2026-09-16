import { describe, expect, it } from "vitest";

import { prepareManualProcedure } from "./manual-procedure";

describe("transcrição manual de procedimento", () => {
  it("aceita um exame canônico e preserva as quantidades informadas", () => {
    expect(prepareManualProcedure({
      examId: "42",
      requestedQuantity: "2",
      authorizedQuantity: "1",
    })).toEqual({
      status: "valid",
      procedure: {
        examId: "42",
        requestedQuantity: 2,
        authorizedQuantity: 1,
        isAuthorized: true,
      },
    });
  });

  it("exclui da autorização o item cuja quantidade autorizada é zero", () => {
    expect(prepareManualProcedure({
      examId: "42",
      requestedQuantity: "1",
      authorizedQuantity: "0",
    })).toEqual({
      status: "valid",
      procedure: {
        examId: "42",
        requestedQuantity: 1,
        authorizedQuantity: 0,
        isAuthorized: false,
      },
    });
  });

  it.each([
    { examId: "", requestedQuantity: "1", authorizedQuantity: "1" },
    { examId: "exam-42", requestedQuantity: "1", authorizedQuantity: "1" },
    { examId: "42", requestedQuantity: "-1", authorizedQuantity: "1" },
    { examId: "42", requestedQuantity: "1.5", authorizedQuantity: "1" },
    { examId: "42", requestedQuantity: "1", authorizedQuantity: "" },
  ])("rejeita campos inválidos: %#", (input) => {
    expect(prepareManualProcedure(input)).toEqual({ status: "invalid" });
  });
});

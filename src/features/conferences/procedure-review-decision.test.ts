import { describe, expect, it } from "vitest";

import { decideProcedureReview } from "./procedure-review-decision";

describe("decisão local sobre um procedimento", () => {
  it("confirma ou substitui somente a revisão local e expande a composição explícita", () => {
    const result = decideProcedureReview(
      { decision: "confirm", selectedExamId: "20", matchedExamId: "10" },
      [{ packageExamId: "20", componentExamId: "21" }],
    );

    expect(result).toEqual({
      status: "success",
      resolution: "replaced",
      resolvedExamId: "20",
      expandedExamIds: ["21"],
    });
  });

  it("exclui o item sem modificar alias ou composição globais", () => {
    const result = decideProcedureReview(
      { decision: "exclude", selectedExamId: null, matchedExamId: "10" },
      [],
    );

    expect(result).toEqual({
      status: "success",
      resolution: "excluded",
      resolvedExamId: null,
      expandedExamIds: [],
    });
  });

  it("exige a seleção de um exame para confirmar um item sem correspondência", () => {
    expect(decideProcedureReview({ decision: "confirm", selectedExamId: null, matchedExamId: null }, [])).toEqual({
      status: "invalid",
      message: "Selecione o exame canônico antes de confirmar.",
    });
  });
});

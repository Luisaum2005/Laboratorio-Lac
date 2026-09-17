import { describe, expect, it } from "vitest";

import { compareMedicalRequest } from "./medical-request-comparison";

describe("comparação entre pedido médico e guia Unimed", () => {
  it("autoriza o exame do pedido quando a guia o confirma com quantidade maior que zero", () => {
    expect(compareMedicalRequest(
      [{ examId: "10", rawText: "Hemograma" }],
      [{ expandedExamIds: ["10"], isAuthorized: true, resolution: "confirmed" }],
    )).toEqual([{ examId: "10", rawText: "Hemograma", status: "authorized" }]);
  });

  it("não autoriza um exame ausente da guia", () => {
    expect(compareMedicalRequest(
      [{ examId: "11", rawText: "Glicemia" }],
      [{ expandedExamIds: ["10"], isAuthorized: true, resolution: "auto_matched" }],
    )).toEqual([{ examId: "11", rawText: "Glicemia", status: "not_authorized" }]);
  });

  it("não autoriza procedimento com quantidade autorizada igual a zero ou ainda pendente", () => {
    expect(compareMedicalRequest(
      [{ examId: "10", rawText: "Hemograma" }],
      [
        { expandedExamIds: ["10"], isAuthorized: false, resolution: "confirmed" },
        { expandedExamIds: ["10"], isAuthorized: true, resolution: "needs_review" },
      ],
    )).toEqual([{ examId: "10", rawText: "Hemograma", status: "not_authorized" }]);
  });
});

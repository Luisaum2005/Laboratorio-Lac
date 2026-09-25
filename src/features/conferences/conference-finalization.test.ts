import { describe, expect, it } from "vitest";

import { prepareConferenceFinalization, resolveExtraApprovalSelection } from "./conference-finalization";

describe("finalização da conferência", () => {
  it("seleciona apenas extras autorizados para as opções de marcados, todos e nenhum", () => {
    const authorizedExtras = [
      { examId: "a", name: "Glicemia", mnemonic: "GLI" },
      { examId: "b", name: "Colesterol", mnemonic: "COL" },
    ];

    expect(resolveExtraApprovalSelection({ mode: "selected", submittedExamIds: ["b", "desconhecido", "b"], authorizedExtras })).toEqual(["b"]);
    expect(resolveExtraApprovalSelection({ mode: "all", submittedExamIds: [], authorizedExtras })).toEqual(["a", "b"]);
    expect(resolveExtraApprovalSelection({ mode: "none", submittedExamIds: ["a"], authorizedExtras })).toEqual([]);
  });

  it("bloqueia a confirmação se um procedimento da guia ainda precisa de revisão", () => {
    expect(prepareConferenceFinalization({
      confirmationAccepted: true,
      hasPendingGuideReview: true,
      requestItems: [{ examId: "10", name: "Hemograma", mnemonic: "HEMO", status: "authorized" }],
      authorizedExtras: [],
      selectedExtraExamIds: [],
    })).toMatchObject({ status: "blocked", reason: "pending_guide_review" });
  });

  it("libera somente exame autorizado do pedido e extra autorizado escolhido explicitamente", () => {
    expect(prepareConferenceFinalization({
      confirmationAccepted: true,
      hasPendingGuideReview: false,
      requestItems: [{ examId: "10", name: "Hemograma", mnemonic: "HEMO", status: "authorized" }],
      authorizedExtras: [
        { examId: "11", name: "Glicemia", mnemonic: "GLI" },
        { examId: "12", name: "Colesterol", mnemonic: "COL" },
      ],
      selectedExtraExamIds: ["11"],
    })).toEqual({
      status: "ready",
      released: [
        { examId: "10", name: "Hemograma", mnemonic: "HEMO", origin: "medical_request" },
        { examId: "11", name: "Glicemia", mnemonic: "GLI", origin: "authorized_extra" },
      ],
    });
  });

  it("permite finalizar sem pedido médico e sem médico informado", () => {
    expect(prepareConferenceFinalization({
      confirmationAccepted: true,
      hasPendingGuideReview: false,
      requestItems: [],
      authorizedExtras: [],
      selectedExtraExamIds: [],
    })).toEqual({ status: "ready", released: [] });
  });
});

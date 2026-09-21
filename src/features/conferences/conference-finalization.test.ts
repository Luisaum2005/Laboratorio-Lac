import { describe, expect, it } from "vitest";

import { prepareConferenceFinalization } from "./conference-finalization";

describe("finalização da conferência", () => {
  it("bloqueia a confirmação se um procedimento da guia ainda precisa de revisão", () => {
    expect(prepareConferenceFinalization({
      confirmationAccepted: true,
      doctorName: "Dra. Ana",
      hasPendingGuideReview: true,
      requestItems: [{ examId: "10", name: "Hemograma", mnemonic: "HEMO", status: "authorized" }],
      authorizedExtras: [],
      selectedExtraExamIds: [],
    })).toMatchObject({ status: "blocked", reason: "pending_guide_review" });
  });

  it("libera somente exame autorizado do pedido e extra autorizado escolhido explicitamente", () => {
    expect(prepareConferenceFinalization({
      confirmationAccepted: true,
      doctorName: "Dra. Ana",
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
});

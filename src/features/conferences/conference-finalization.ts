export type FinalizationExam = { examId: string; name: string; mnemonic: string };

type FinalizationInput = {
  confirmationAccepted: boolean;
  doctorName: string | null;
  hasPendingGuideReview: boolean;
  requestItems: Array<FinalizationExam & { status: "authorized" | "not_authorized" }>;
  authorizedExtras: FinalizationExam[];
  selectedExtraExamIds: string[];
};

type ReleasedExam = FinalizationExam & { origin: "medical_request" | "authorized_extra" };

export function prepareConferenceFinalization(input: FinalizationInput):
  | { status: "blocked"; reason: "pending_guide_review" | "medical_request_incomplete" | "not_authorized_request" | "confirmation_required" }
  | { status: "ready"; released: ReleasedExam[] } {
  if (input.hasPendingGuideReview) return { status: "blocked", reason: "pending_guide_review" };
  if (!input.doctorName?.trim() || input.requestItems.length === 0) return { status: "blocked", reason: "medical_request_incomplete" };
  if (input.requestItems.some((item) => item.status === "not_authorized")) return { status: "blocked", reason: "not_authorized_request" };
  if (!input.confirmationAccepted) return { status: "blocked", reason: "confirmation_required" };

  const selectedExtraExamIds = new Set(input.selectedExtraExamIds);
  return {
    status: "ready",
    released: [
      ...input.requestItems.map(({ status: _status, ...item }) => ({ ...item, origin: "medical_request" as const })),
      ...input.authorizedExtras.filter((item) => selectedExtraExamIds.has(item.examId)).map((item) => ({ ...item, origin: "authorized_extra" as const })),
    ],
  };
}

export type FinalizationExam = { examId: string; name: string; mnemonic: string };

type FinalizationInput = {
  confirmationAccepted: boolean;
  hasPendingGuideReview: boolean;
  requestItems: Array<FinalizationExam & { status: "authorized" | "not_authorized" }>;
  authorizedExtras: FinalizationExam[];
  selectedExtraExamIds: string[];
};

type ReleasedExam = FinalizationExam & { origin: "medical_request" | "authorized_extra" };

export function resolveExtraApprovalSelection(input: {
  mode: FormDataEntryValue | null;
  submittedExamIds: FormDataEntryValue[];
  authorizedExtras: FinalizationExam[];
}): string[] {
  const authorizedIds = new Set(input.authorizedExtras.map((exam) => exam.examId));
  if (input.mode === "all") return [...authorizedIds];
  if (input.mode === "none") return [];
  return [...new Set(input.submittedExamIds.filter((id): id is string => typeof id === "string" && authorizedIds.has(id)))];
}

export function prepareConferenceFinalization(input: FinalizationInput):
  | { status: "blocked"; reason: "pending_guide_review" | "not_authorized_request" | "confirmation_required" }
  | { status: "ready"; released: ReleasedExam[] } {
  if (input.hasPendingGuideReview) return { status: "blocked", reason: "pending_guide_review" };
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

export type MedicalRequestItem = { examId: string; rawText: string };

type AuthorizedGuideProcedure = {
  expandedExamIds: string[];
  isAuthorized: boolean;
  resolution: "auto_matched" | "needs_review" | "confirmed" | "replaced" | "excluded";
};

export function compareMedicalRequest(
  requestItems: MedicalRequestItem[],
  guideProcedures: AuthorizedGuideProcedure[],
) {
  return requestItems.map((item) => ({
    ...item,
    status: guideProcedures.some((procedure) => procedure.isAuthorized
      && procedure.resolution !== "needs_review"
      && procedure.resolution !== "excluded"
      && procedure.expandedExamIds.includes(item.examId)) ? "authorized" as const : "not_authorized" as const,
  }));
}

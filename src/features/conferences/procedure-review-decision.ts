import { expandExplicitComposition, type ExplicitComposition } from "./procedure-review";

export type ProcedureReviewDecisionResult =
  | {
    status: "success";
    resolution: "confirmed" | "replaced" | "excluded";
    resolvedExamId: string | null;
    expandedExamIds: string[];
  }
  | { status: "invalid"; message: string };

export function decideProcedureReview(
  input: { decision: "confirm" | "exclude"; selectedExamId: string | null; matchedExamId: string | null },
  compositions: ExplicitComposition[],
): ProcedureReviewDecisionResult {
  if (input.decision === "exclude") {
    return {
      status: "success",
      resolution: "excluded",
      resolvedExamId: null,
      expandedExamIds: [],
    };
  }

  const selectedExamId = input.selectedExamId?.trim();
  if (!selectedExamId) {
    return { status: "invalid", message: "Selecione o exame canônico antes de confirmar." };
  }
  return {
    status: "success",
    resolution: selectedExamId === input.matchedExamId ? "confirmed" : "replaced",
    resolvedExamId: selectedExamId,
    expandedExamIds: expandExplicitComposition(selectedExamId, compositions),
  };
}

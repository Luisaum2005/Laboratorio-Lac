import type { ConferenceProcedureReviewDisplay } from "./procedure-review-page";

export type ProcedureApprovalIssue = { reviewId: string; description: string; reason: string };

export function findProcedureApprovalIssues(reviews: ConferenceProcedureReviewDisplay[]): ProcedureApprovalIssue[] {
  const issues = reviews.flatMap((review) => {
    if (review.resolution === "excluded") return [];

    const reviewIssues: ProcedureApprovalIssue[] = [];
    if (review.resolution === "needs_review") {
      reviewIssues.push({ reviewId: review.id, description: review.description, reason: "Não foi associado a um exame do catálogo." });
    }
    if (!review.isAuthorized) {
      reviewIssues.push({ reviewId: review.id, description: review.description, reason: "Consta como não autorizado na guia Unimed." });
    }
    if (review.authorizedQuantity !== review.requestedQuantity) {
      reviewIssues.push({
        reviewId: review.id,
        description: review.description,
        reason: `Quantidade divergente: ${review.requestedQuantity} solicitada e ${review.authorizedQuantity} autorizada.`,
      });
    }
    return reviewIssues;
  });

  if (reviews.length > 0 && reviews.every((review) => review.resolution === "excluded")) {
    issues.push({ reviewId: "none", description: "Nenhum procedimento", reason: "Todos os itens foram excluídos; não há exames para aprovar." });
  }
  return issues;
}

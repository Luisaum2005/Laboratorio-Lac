export type ConferenceProcedureReviewDisplay = {
  id: string;
  rawText: string;
  page: number | null;
  code: string | null;
  description: string;
  requestedQuantity: number;
  authorizedQuantity: number;
  isAuthorized: boolean;
  resolution: "auto_matched" | "needs_review" | "confirmed" | "replaced" | "excluded";
  matchedExamId: string | null;
  resolvedExamId: string | null;
  entryOrigin?: "extracted" | "manual";
};

import type { SelectableExam } from "./manual-procedure-page";
import { findProcedureApprovalIssues } from "./procedure-approval";

export type { SelectableExam } from "./manual-procedure-page";

function resolutionLabel(resolution: ConferenceProcedureReviewDisplay["resolution"]) {
  const labels = {
    auto_matched: "Correspondência automática",
    needs_review: "Necessita revisão",
    confirmed: "Confirmado",
    replaced: "Exame substituído",
    excluded: "Item excluído",
  } as const;
  return labels[resolution];
}

export function ConferenceProcedureReviewView({
  conferenceId,
  reviews,
  exams,
  reviewAction,
  approveAction,
  blocked,
}: {
  conferenceId: string;
  reviews: ConferenceProcedureReviewDisplay[];
  exams: SelectableExam[];
  reviewAction: (formData: FormData) => Promise<void>;
  approveAction: (formData: FormData) => Promise<void>;
  blocked: boolean;
}) {
  if (reviews.length === 0) return null;
  const approvalIssues = findProcedureApprovalIssues(reviews);
  const eligibleCount = reviews.filter((review) => review.resolution !== "excluded").length;

  return (
    <section className="governance-card procedure-review-card" aria-labelledby="procedure-review-heading">
      <h2 id="procedure-review-heading">Revisão dos procedimentos</h2>
      <p>Confira o resultado geral e aprove os itens regulares de uma só vez. Se houver divergência, ela será indicada abaixo.</p>
      {blocked || approvalIssues.length > 0 ? <div className="notice notice-error review-approval-alert" role="alert">
        <strong>Não é possível aprovar todos os exames ainda.</strong>
        <span>Resolva os itens sinalizados para continuar:</span>
        <ul>{approvalIssues.map((issue, index) => <li key={`${issue.reviewId}-${index}`}><strong>{issue.description}:</strong> {issue.reason}</li>)}</ul>
      </div> : <p className="notice notice-success">Nenhuma irregularidade encontrada. Os {eligibleCount} {eligibleCount === 1 ? "exame está" : "exames estão"} prontos para aprovação.</p>}
      <form action={approveAction} className="review-approval-form">
        <input type="hidden" name="conferenceId" value={conferenceId} />
        <button type="submit" className="review-approve-button" disabled={approvalIssues.length > 0}>Aprovar exames ({eligibleCount})</button>
      </form>
      <details className="procedure-review-details">
        <summary>Ver detalhes dos exames ({reviews.length})</summary>
        <ul className="procedure-review-list">
          {reviews.map((review) => (
            <li key={review.id} className="procedure-review-item">
              <div>
                <strong>{review.description}</strong>
                <span className={`status-badge status-${review.resolution}`}>{resolutionLabel(review.resolution)}</span>
                <p>{review.entryOrigin === "manual" ? "Texto registrado manualmente" : "Texto extraído"}: {review.rawText}</p>
                <p>{review.page === null ? "Preenchimento manual" : `Página ${review.page}`} · Solicitado: {review.requestedQuantity} · Autorizado: {review.authorizedQuantity}</p>
                {!review.isAuthorized ? <p>Item não autorizado na guia.</p> : null}
              </div>
              {review.resolution === "excluded" ? null : (
                <form action={reviewAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <label htmlFor={`exam-${review.id}`}>Exame canônico para {review.description}</label>
                  <select id={`exam-${review.id}`} name="examId" defaultValue={review.resolvedExamId ?? ""}>
                    <option value="">Selecione um exame</option>
                    {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} ({exam.mnemonic})</option>)}
                  </select>
                  <button type="submit" name="decision" value="confirm">Confirmar exame</button>
                  <button type="submit" name="decision" value="exclude">Excluir item</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

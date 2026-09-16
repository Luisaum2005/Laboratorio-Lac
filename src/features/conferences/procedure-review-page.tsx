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

export type SelectableExam = { id: string; name: string; mnemonic: string };

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
  reviews,
  exams,
  reviewAction,
  blocked,
}: {
  reviews: ConferenceProcedureReviewDisplay[];
  exams: SelectableExam[];
  reviewAction: (formData: FormData) => Promise<void>;
  blocked: boolean;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="governance-card procedure-review-card" aria-labelledby="procedure-review-heading">
      <h2 id="procedure-review-heading">Revisão dos procedimentos</h2>
      <p>Confirme, substitua ou exclua cada item. O catálogo não será alterado por esta decisão.</p>
      {blocked ? <p className="notice notice-error">A comparação permanece bloqueada enquanto existir item necessitando revisão.</p> : null}
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
    </section>
  );
}

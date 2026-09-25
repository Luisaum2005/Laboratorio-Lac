type FinalizationRequestItem = { examId: string; name: string; mnemonic: string; status: "authorized" | "not_authorized" };

export function ConferenceFinalizationView({ conferenceId, blockedReason, requestItems, extras, finalizeAction }: {
  conferenceId: string;
  blockedReason: string | null;
  requestItems: FinalizationRequestItem[];
  extras: Array<{ examId: string; name: string; mnemonic: string }>;
  finalizeAction: (formData: FormData) => Promise<void>;
}) {
  const divergences = requestItems.filter((item) => item.status === "not_authorized");
  return <section className="governance-card procedure-review-card" aria-labelledby="finalization-heading">
    <h2 id="finalization-heading">Confirmação operacional</h2>
    <p>Confira os exames do pedido e os extras autorizados. Você pode incluir apenas os extras marcados ou todos de uma vez.</p>
    {blockedReason ? <p className="notice notice-error">{blockedReason}</p> : null}
    <form action={finalizeAction}>
      <input type="hidden" name="conferenceId" value={conferenceId} />
      <div className="finalization-exam-columns">
        <section className="finalization-exam-panel" aria-labelledby="released-exams-heading">
          <h3 id="released-exams-heading">Exames autorizados do pedido</h3>
          {requestItems.length === 0 ? <p>Pedido médico não informado; nenhum exame desse pedido será incluído.</p> : <ul>
            {requestItems.map((exam) => <li key={exam.examId}>
              <strong>{exam.name}</strong>
              <span><code>{exam.mnemonic}</code> — {exam.status === "authorized" ? "Autorizado" : "Não autorizado"}</span>
            </li>)}
          </ul>}
          {divergences.length > 0 ? <section className="finalization-divergences" aria-labelledby="divergences-heading">
            <h4 id="divergences-heading">Divergências</h4>
            <p>Os itens abaixo não serão liberados na ficha enquanto a divergência não for resolvida.</p>
            <ul>{divergences.map((exam) => <li key={exam.examId}>{exam.name} ({exam.mnemonic})</li>)}</ul>
          </section> : <p className="notice notice-success">Nenhuma divergência entre o pedido médico e a guia autorizada.</p>}
        </section>

        <fieldset className="finalization-exam-panel finalization-extras-panel" disabled={Boolean(blockedReason)}>
          <legend>Extras autorizados</legend>
          {extras.length === 0 ? <p>Nenhum extra autorizado disponível.</p> : <>
            <p className="field-hint">Marque os extras que deseja incluir ou use “Aprovar todos”.</p>
            <ul>{extras.map((exam) => <li key={exam.examId}>
              <label>
                <input type="checkbox" name="selectedExtraExamIds" value={exam.examId} />
                <span>{exam.name} <code>{exam.mnemonic}</code></span>
              </label>
            </li>)}</ul>
          </>}
        </fieldset>
      </div>
      <label className="finalization-confirmation">
        <input type="checkbox" name="confirmationAccepted" value="yes" required disabled={Boolean(blockedReason)} />
        Confiro que revisei os exames e as divergências antes de finalizar.
      </label>
      <div className="finalization-actions">
        {extras.length === 0 ? <button type="submit" name="extrasApprovalMode" value="none" disabled={Boolean(blockedReason)}>Finalizar e gerar ficha LAC</button> : <>
          <button type="submit" name="extrasApprovalMode" value="selected" disabled={Boolean(blockedReason)}>Aprovar selecionados e gerar ficha LAC</button>
          <button type="submit" name="extrasApprovalMode" value="all" disabled={Boolean(blockedReason)}>Aprovar todos e gerar ficha LAC</button>
          <button type="submit" className="button-quiet" name="extrasApprovalMode" value="none" disabled={Boolean(blockedReason)}>Finalizar sem extras</button>
        </>}
      </div>
    </form>
  </section>;
}

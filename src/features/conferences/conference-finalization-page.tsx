export function ConferenceFinalizationView({ conferenceId, blockedReason, extras, finalizeAction }: {
  conferenceId: string;
  blockedReason: string | null;
  extras: Array<{ examId: string; name: string; mnemonic: string }>;
  finalizeAction: (formData: FormData) => Promise<void>;
}) {
  return <section className="governance-card procedure-review-card" aria-labelledby="finalization-heading">
    <h2 id="finalization-heading">Confirmação operacional</h2>
    <p>Revise as divergências e escolha, se necessário, extras autorizados que devem entrar na ficha LAC.</p>
    {blockedReason ? <p className="notice notice-error">{blockedReason}</p> : null}
    <form action={finalizeAction}>
      <input type="hidden" name="conferenceId" value={conferenceId} />
      <fieldset disabled={Boolean(blockedReason)}>
        <legend>Extras autorizados</legend>
        {extras.length === 0 ? <p>Nenhum extra autorizado disponível.</p> : extras.map((exam) => <label key={exam.examId}>
          <input type="checkbox" name="selectedExtraExamIds" value={exam.examId} />
          {` Incluir ${exam.name} (${exam.mnemonic})`}
        </label>)}
        <label>
          <input type="checkbox" name="confirmationAccepted" value="yes" required />
          {" Confiro que revisei exames e divergências antes de finalizar."}
        </label>
      </fieldset>
      <button type="submit" disabled={Boolean(blockedReason)}>Finalizar e gerar ficha LAC</button>
    </form>
  </section>;
}

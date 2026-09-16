import type { SelectableExam } from "./procedure-review-page";

export function ManualProcedureTranscriptionView({
  conferenceId,
  exams,
  saveAction,
}: {
  conferenceId: string;
  exams: SelectableExam[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="governance-card procedure-review-card" aria-labelledby="manual-procedure-heading">
      <h2 id="manual-procedure-heading">Transcrição manual dos procedimentos</h2>
      <p>Não foi possível ler os procedimentos do PDF. Registre cada item manualmente; esta ação não altera aliases do catálogo.</p>
      <form action={saveAction}>
        <input type="hidden" name="conferenceId" value={conferenceId} />
        <label htmlFor="manual-text">Texto registrado manualmente</label>
        <input id="manual-text" name="manualText" required />
        <label htmlFor="manual-exam">Exame do catálogo</label>
        <input id="manual-exam" name="examId" list="manual-exams" required inputMode="numeric" />
        <datalist id="manual-exams">
          {exams.map((exam) => <option key={exam.id} value={exam.id} label={`${exam.name} (${exam.mnemonic})`} />)}
        </datalist>
        <label htmlFor="requested-quantity">Quantidade solicitada</label>
        <input id="requested-quantity" name="requestedQuantity" type="number" min="0" step="1" required />
        <label htmlFor="authorized-quantity">Quantidade autorizada</label>
        <input id="authorized-quantity" name="authorizedQuantity" type="number" min="0" step="1" required />
        <button type="submit">Adicionar procedimento manual</button>
      </form>
    </section>
  );
}

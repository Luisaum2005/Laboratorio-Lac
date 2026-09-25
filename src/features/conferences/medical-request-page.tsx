import type { SelectableExam } from "./manual-procedure-page";
import { MedicalRequestForm } from "./medical-request-form";

export function MedicalRequestView({ conferenceId, doctorName, exams, items, saveAction, removeAction, comparisonBlocked }: {
  conferenceId: string; doctorName: string | null; exams: SelectableExam[];
  items: Array<{ id: string; rawText: string; examId: string; examName: string; mnemonic: string; status: "authorized" | "not_authorized" }>;
  saveAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  comparisonBlocked: boolean;
}) {
  return <section className="governance-card procedure-review-card medical-request-card" aria-labelledby="medical-request-heading">
    <div className="section-heading">
      <span className="step-marker" aria-hidden="true">02</span>
      <div>
        <p className="section-kicker">Pedido do paciente · opcional</p>
        <h2 id="medical-request-heading">Pedido médico e exames</h2>
        <p className="section-description">Se houver pedido médico, registre os dados e selecione os exames. Sem pedido, siga direto para a próxima etapa.</p>
      </div>
    </div>
    <p className="notice notice-info"><strong>Importante:</strong> um exame só é autorizado se constar como autorizado na guia Unimed.</p>
    <MedicalRequestForm conferenceId={conferenceId} doctorName={doctorName} exams={exams} saveAction={saveAction} />
    {comparisonBlocked ? <p className="notice notice-error">A comparação permanece pendente enquanto existir item da guia necessitando de revisão.</p> : null}
    {items.length > 0 ? <ul aria-label="Exames do pedido médico">{items.map((item) => <li key={item.id}>
      <div className="request-exam-summary">
        <div className="request-exam-title"><strong>{item.examName}</strong><code>{item.mnemonic}</code></div>
        <span className={`status-badge ${item.status === "authorized" ? "status-authorized" : "status-unauthorized"}`}>{item.status === "authorized" ? "Autorizado pela guia" : "Não autorizado pela guia"}</span>
        <span className="request-raw-text">{item.rawText}</span>
      </div>
      <form action={removeAction} className="request-remove-form"><input type="hidden" name="conferenceId" value={conferenceId} /><input type="hidden" name="itemId" value={item.id} /><button className="button-quiet" type="submit" aria-label={`Remover ${item.examName} do pedido`}>Remover</button></form>
    </li>)}</ul> : null}
  </section>;
}

import type { SelectableExam } from "./manual-procedure-page";

export function MedicalRequestView({ conferenceId, doctorName, exams, items, saveAction, comparisonBlocked }: {
  conferenceId: string; doctorName: string | null; exams: SelectableExam[];
  items: Array<{ id: string; rawText: string; examId: string; status: "authorized" | "not_authorized" }>;
  saveAction: (formData: FormData) => Promise<void>;
  comparisonBlocked: boolean;
}) {
  return <section className="governance-card procedure-review-card" aria-labelledby="medical-request-heading">
    <h2 id="medical-request-heading">Pedido médico</h2>
    <p>Preenchimento manual. Um exame só é autorizado se constar como autorizado na guia Unimed.</p>
    <form action={saveAction}>
      <input type="hidden" name="conferenceId" value={conferenceId} />
      <label htmlFor="doctor-name">Médico solicitante</label>
      <input id="doctor-name" name="doctorName" defaultValue={doctorName ?? ""} required />
      <label htmlFor="request-raw-text">Texto do pedido</label>
      <input id="request-raw-text" name="rawText" required />
      <label htmlFor="request-exam">Exame do catálogo</label>
      <select id="request-exam" name="examId" required defaultValue=""><option value="">Selecione um exame</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} ({exam.mnemonic})</option>)}</select>
      <button type="submit">Adicionar exame do pedido</button>
    </form>
    {comparisonBlocked ? <p className="notice notice-error">A comparação do pedido permanece bloqueada enquanto existir item da guia necessitando de revisão.</p> : <ul>{items.map((item) => <li key={item.id}><strong>{item.rawText}</strong> — {item.status === "authorized" ? "Autorizado" : "Não autorizado"}</li>)}</ul>}
  </section>;
}

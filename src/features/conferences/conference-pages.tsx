import Link from "next/link";
import type { ReactNode } from "react";

export type ConferenceSummary = {
  id: string;
  status: "draft" | "processing";
  createdAt: string;
  hasSourceFile?: boolean;
};

type Notice = { tone: "success" | "error"; message: string };

export function ConferenceListPageView({
  conferences,
  createDraftAction,
  notice,
}: {
  conferences: ConferenceSummary[];
  createDraftAction: () => Promise<void>;
  notice?: Notice;
}) {
  return (
    <main className="catalog-shell">
      <header className="catalog-header">
        <p className="eyebrow">Laboratório LAC</p>
        <h1>Conferências</h1>
        <Link href="/catalogo">Consultar catálogo</Link>
      </header>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      <form action={createDraftAction} className="governance-card conference-start-card">
        <h2>Iniciar nova conferência</h2>
        <p>Crie um rascunho antes de enviar a ficha Unimed.</p>
        <button type="submit">Nova conferência</button>
      </form>

      <section className="table-card" aria-labelledby="recent-conferences">
        <h2 id="recent-conferences">Conferências recentes</h2>
        {conferences.length === 0 ? <p className="catalog-count">Nenhuma conferência iniciada ainda.</p> : (
          <ul className="conference-list">
            {conferences.map((conference) => (
              <li key={conference.id}>
                <div>
                  <strong>Conferência iniciada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conference.createdAt))}</strong>
                  <span className={`status-badge status-${conference.status}`}>{conference.status === "processing" ? "Processamento iniciado" : conference.hasSourceFile ? "Aguardando processamento" : "Rascunho"}</span>
                </div>
                <Link href={`/conferencias/${conference.id}`}>Abrir conferência</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export function ConferenceUploadPageView({
  conference,
  uploadAction,
  retryProcessingAction,
  procedureReview,
  manualTranscription,
  medicalRequest,
  notice,
}: {
  conference: ConferenceSummary;
  uploadAction: (formData: FormData) => Promise<void>;
  retryProcessingAction?: (formData: FormData) => Promise<void>;
  procedureReview?: ReactNode;
  manualTranscription?: ReactNode;
  medicalRequest?: ReactNode;
  notice?: Notice;
}) {
  const processing = conference.status === "processing";
  const awaitingProcessing = !processing && conference.hasSourceFile;

  return (
    <main className="catalog-shell">
      <Link className="back-link" href="/conferencias">Voltar às conferências</Link>
      <header className="catalog-header">
        <p className="eyebrow">Conferência</p>
        <h1>{processing ? "Processamento iniciado" : awaitingProcessing ? "Aguardando processamento" : "Enviar ficha Unimed"}</h1>
        <span className={`status-badge status-${conference.status}`}>{processing ? "Processamento iniciado" : awaitingProcessing ? "Aguardando processamento" : "Rascunho"}</span>
      </header>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      {processing || awaitingProcessing ? (
        <section className="governance-card" aria-labelledby="processing-heading">
          <h2 id="processing-heading">{processing ? "A ficha está em processamento" : "A ficha está pronta para processamento"}</h2>
          <p>{processing ? "O arquivo foi guardado em área privada. A próxima etapa mostrará a leitura dos dados extraídos." : "O arquivo foi guardado em área privada. Ele será encaminhado ao serviço de leitura assim que esse serviço estiver disponível."}</p>
          {awaitingProcessing && retryProcessingAction ? (
            <form action={retryProcessingAction}>
              <input type="hidden" name="conferenceId" value={conference.id} />
              <button type="submit">Tentar iniciar processamento</button>
            </form>
          ) : null}
        </section>
      ) : (
        <form action={uploadAction} className="governance-card conference-upload-form">
          <input type="hidden" name="conferenceId" value={conference.id} />
          <fieldset>
            <legend>Ficha Unimed em PDF</legend>
            <p>Envie somente PDF com até 10 MB e 10 páginas. O rascunho será mantido se houver algum problema.</p>
            <label htmlFor="source-file">Arquivo da ficha</label>
            <input id="source-file" name="sourceFile" type="file" accept="application/pdf,.pdf" required />
            <button type="submit">Enviar e iniciar processamento</button>
          </fieldset>
        </form>
      )}
      {procedureReview}
      {manualTranscription}
      {medicalRequest}
    </main>
  );
}

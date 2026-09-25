import Link from "next/link";
import type { ReactNode } from "react";
import { ConferenceListActions } from "./conference-list-actions";

export type ConferenceSummary = {
  id: string;
  status: "draft" | "processing" | "finalized";
  createdAt: string;
  hasSourceFile?: boolean;
  hasExtractionResult?: boolean;
  patientName?: string | null;
  revisionNumber?: number;
};

type Notice = { tone: "success" | "error"; message: string };

export type GuideMetadata = {
  patient_name?: string | null;
  doctor_name?: string | null;
  request_date?: string | null;
  guide_number?: string | null;
  clinical_indication?: string | null;
};

const guideMetadataLabels: Array<[keyof GuideMetadata, string]> = [
  ["patient_name", "Paciente"],
  ["doctor_name", "Médico solicitante"],
  ["request_date", "Data da solicitação"],
  ["guide_number", "Número da guia"],
  ["clinical_indication", "Indicação clínica"],
];

export function GuideMetadataView({ metadata }: { metadata: GuideMetadata }) {
  const visibleFields = guideMetadataLabels.filter(([key]) => Boolean(metadata[key]?.trim()));
  if (visibleFields.length === 0) return null;

  return (
    <section className="governance-card guide-metadata-card" aria-labelledby="guide-metadata-heading">
      <h2 id="guide-metadata-heading">Dados extraídos da guia</h2>
      <p>Confira estes dados antes de concluir a conferência. Eles vieram do PDF e não alteram o catálogo.</p>
      <dl className="guide-metadata-list">
        {visibleFields.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{metadata[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ConferenceListPageView({
  conferences,
  createDraftAction,
  deleteAction,
  revisionAction,
  notice,
  patientSearch,
}: {
  conferences: ConferenceSummary[];
  createDraftAction: () => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  revisionAction: (formData: FormData) => Promise<void>;
  notice?: Notice;
  patientSearch?: string;
}) {
  return (
    <main className="catalog-shell">
      <header className="catalog-header">
        <p className="eyebrow">Laboratório LAC</p>
        <h1>Conferências</h1>
        <Link className="action-link action-link--secondary" href="/catalogo">Consultar catálogo</Link>
      </header>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      <form action={createDraftAction} className="governance-card conference-start-card">
        <h2>Iniciar nova conferência</h2>
        <p>Crie um rascunho antes de enviar a ficha Unimed.</p>
        <button type="submit">Nova conferência</button>
      </form>

      <form method="get" className="governance-card">
        <label htmlFor="patient-search">Buscar por paciente</label>
        <input id="patient-search" name="patient" defaultValue={patientSearch ?? ""} />
        <button type="submit">Pesquisar histórico</button>
      </form>

      <section className="table-card" aria-labelledby="recent-conferences">
        <h2 id="recent-conferences">Conferências recentes</h2>
        {conferences.length === 0 ? <p className="catalog-count">Nenhuma conferência iniciada ainda.</p> : (
          <ul className="conference-list">
            {conferences.map((conference) => (
              <li key={conference.id}>
                <div>
                  <strong>Conferência iniciada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conference.createdAt))}</strong>
                  {conference.patientName ? <span>Paciente: {conference.patientName}</span> : null}
                  <span>Revisão {conference.revisionNumber ?? 1}</span>
                  <span className={`status-badge status-${conference.status}`}>{conference.status === "finalized" ? "Finalizada" : conference.hasExtractionResult ? "Leitura concluída" : conference.status === "processing" ? "Processamento iniciado" : conference.hasSourceFile ? "Aguardando processamento" : "Rascunho"}</span>
                </div>
                <ConferenceListActions
                  conferenceId={conference.id}
                  finalized={conference.status === "finalized"}
                  deleteAction={deleteAction}
                  revisionAction={revisionAction}
                />
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
  finalization,
  notice,
  hasExtractionResult = false,
  guideMetadata,
}: {
  conference: ConferenceSummary;
  uploadAction: (formData: FormData) => Promise<void>;
  retryProcessingAction?: (formData: FormData) => Promise<void>;
  procedureReview?: ReactNode;
  manualTranscription?: ReactNode;
  medicalRequest?: ReactNode;
  finalization?: ReactNode;
  notice?: Notice;
  hasExtractionResult?: boolean;
  guideMetadata?: GuideMetadata;
}) {
  const processing = conference.status === "processing" && !hasExtractionResult;
  const awaitingProcessing = !processing && !hasExtractionResult && conference.hasSourceFile;
  const statusLabel = hasExtractionResult
    ? "Leitura concluída"
    : processing
      ? "Processamento iniciado"
      : awaitingProcessing
        ? "Aguardando processamento"
        : "Rascunho";

  return (
    <main className="catalog-shell conference-flow-shell">
      <Link className="back-link" href="/conferencias">Voltar às conferências</Link>
      <header className="catalog-header conference-header">
        <p className="eyebrow">Atendimento laboratorial <span aria-hidden="true">/</span> Conferência</p>
        <div className="conference-header-title">
          <div>
            <h1>{hasExtractionResult ? "Conferir guia Unimed" : processing ? "Processamento iniciado" : awaitingProcessing ? "Aguardando processamento" : "Enviar ficha Unimed"}</h1>
            <p>{hasExtractionResult ? "Revise a autorização, registre o pedido médico e prepare a ficha do laboratório." : "Importe o PDF da guia para iniciar uma nova conferência."}</p>
          </div>
          <span className={`status-badge status-${conference.status}`}>{statusLabel}</span>
        </div>
      </header>

      <ol className="workflow-progress" aria-label="Etapas da conferência">
        <li className={!hasExtractionResult ? "is-current" : "is-complete"} aria-current={!hasExtractionResult ? "step" : undefined}>
          <span className="workflow-step-number">{hasExtractionResult ? "✓" : "01"}</span>
          <span><strong>Guia Unimed</strong><small>Importação e autorização</small></span>
        </li>
        <li className={hasExtractionResult ? "is-current" : ""} aria-current={hasExtractionResult ? "step" : undefined}>
          <span className="workflow-step-number">02</span>
          <span><strong>Pedido médico</strong><small>Seleção e conferência</small></span>
        </li>
        <li>
          <span className="workflow-step-number">03</span>
          <span><strong>Ficha LAC</strong><small>Revisão e emissão</small></span>
        </li>
      </ol>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      {hasExtractionResult && guideMetadata ? <GuideMetadataView metadata={guideMetadata} /> : null}

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
            <p>Envie o documento fornecido pelo paciente em PDF, com até 10 MB e 10 páginas. Se houver algum problema, o rascunho será mantido.</p>
            <label className="upload-dropzone" htmlFor="source-file">
              <span className="upload-file-icon" aria-hidden="true">PDF</span>
              <span className="upload-copy"><strong>Escolha o arquivo da guia</strong><small>PDF até 10 MB · até 10 páginas</small></span>
              <input id="source-file" name="sourceFile" type="file" accept="application/pdf,.pdf" required />
            </label>
            <button type="submit">Enviar guia e iniciar</button>
          </fieldset>
        </form>
      )}
      {procedureReview}
      {manualTranscription}
      {medicalRequest}
      {finalization}
    </main>
  );
}

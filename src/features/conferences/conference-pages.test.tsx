import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { conferenceNotice } from "./conference-notices";
import { ConferenceListPageView, ConferenceUploadPageView } from "./conference-pages";
import { MedicalRequestView } from "./medical-request-page";

describe("telas de início da conferência", () => {
  it("oferece a criação de rascunho para o funcionário", () => {
    render(<ConferenceListPageView conferences={[]} createDraftAction={vi.fn()} deleteAction={vi.fn()} revisionAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Conferências" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nova conferência" })).toBeVisible();
    expect(screen.getByText("Nenhuma conferência iniciada ainda.")).toBeVisible();
  });

  it("mostra leitura concluída no histórico quando a extração já terminou", () => {
    render(
      <ConferenceListPageView
        conferences={[{
          id: "conference-1",
          status: "processing",
          createdAt: "2026-09-14T10:00:00Z",
          hasSourceFile: true,
          hasExtractionResult: true,
          patientName: "MATIAS GALHARDO ALVES",
        }]}
        createDraftAction={vi.fn()}
        deleteAction={vi.fn()}
        revisionAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Leitura concluída")).toBeVisible();
    expect(screen.getByRole("link", { name: "Editar conferência" })).toHaveAttribute("href", "/conferencias/conference-1");
    expect(screen.getByRole("button", { name: "Excluir" })).toBeVisible();
  });

  it("oferece nova revisão para editar uma conferência finalizada", () => {
    render(
      <ConferenceListPageView
        conferences={[{ id: "conference-final", status: "finalized", createdAt: "2026-09-14T10:00:00Z" }]}
        createDraftAction={vi.fn()}
        deleteAction={vi.fn()}
        revisionAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Editar em nova revisão" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeVisible();
  });

  it("informa limites e preservação do rascunho antes do envio", () => {
    render(
      <ConferenceUploadPageView
        conference={{ id: "0c8a2252-7229-418d-a478-4a97d568685f", status: "draft", createdAt: "2026-09-14T10:00:00Z" }}
        uploadAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Enviar ficha Unimed" })).toBeVisible();
    expect(screen.getByLabelText(/Escolha o arquivo da guia/)).toHaveAttribute("accept", "application/pdf,.pdf");
    expect(screen.getByText(/até 10 MB e 10 páginas/i)).toBeVisible();
    expect(screen.getByText(/o rascunho será mantido/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar guia e iniciar" })).toBeVisible();
  });

  it("não aceita valores herdados como mensagem de erro", () => {
    expect(conferenceNotice({ error: "__proto__" })).toBeUndefined();
  });

  it("permite repetir o processamento de um arquivo privado já enviado", () => {
    render(
      <ConferenceUploadPageView
        conference={{ id: "0c8a2252-7229-418d-a478-4a97d568685f", status: "draft", createdAt: "2026-09-14T10:00:00Z", hasSourceFile: true }}
        uploadAction={vi.fn()}
        retryProcessingAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Tentar iniciar processamento" })).toBeVisible();
    expect(screen.queryByLabelText("Arquivo da ficha")).not.toBeInTheDocument();
  });

  it("mostra os dados extraídos e troca o estado da tela para conferência", () => {
    render(
      <ConferenceUploadPageView
        conference={{ id: "0c8a2252-7229-418d-a478-4a97d568685f", status: "processing", createdAt: "2026-09-14T10:00:00Z", hasSourceFile: true }}
        uploadAction={vi.fn()}
        hasExtractionResult
        guideMetadata={{
          patient_name: "MATIAS GALHARDO ALVES",
          doctor_name: "PATRICIA ARANTES ROSA",
          request_date: "31/08/2026",
          guide_number: "19053822",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Conferir guia Unimed" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dados extraídos da guia" })).toBeVisible();
    expect(screen.getByText("Leitura concluída")).toBeVisible();
    expect(screen.getByText("MATIAS GALHARDO ALVES")).toBeVisible();
    expect(screen.getByText("PATRICIA ARANTES ROSA")).toBeVisible();
    expect(screen.getByText("31/08/2026")).toBeVisible();
    expect(screen.queryByText("A ficha está em processamento")).not.toBeInTheDocument();
  });

  it("mantém a comparação visível e permite remover um exame do pedido", () => {
    render(
      <MedicalRequestView
        conferenceId="conference-1"
        doctorName="Dra. Teste"
        exams={[{ id: "10", name: "HEMOGRAMA COMPLETO", mnemonic: "HM" }]}
        items={[{ id: "item-1", examId: "10", examName: "HEMOGRAMA COMPLETO", mnemonic: "HM", rawText: "Hemograma", status: "not_authorized" }]}
        saveAction={vi.fn()}
        removeAction={vi.fn()}
        comparisonBlocked
      />,
    );

    expect(screen.getByText("A comparação permanece pendente enquanto existir item da guia necessitando de revisão.")).toBeVisible();
    expect(screen.getByText("HEMOGRAMA COMPLETO", { selector: ".request-exam-title strong" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remover HEMOGRAMA COMPLETO do pedido" })).toBeVisible();
  });
});

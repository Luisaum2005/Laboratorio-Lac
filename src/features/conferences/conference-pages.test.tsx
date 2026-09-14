import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { conferenceNotice } from "./conference-notices";
import { ConferenceListPageView, ConferenceUploadPageView } from "./conference-pages";

describe("telas de início da conferência", () => {
  it("oferece a criação de rascunho para o funcionário", () => {
    render(<ConferenceListPageView conferences={[]} createDraftAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Conferências" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nova conferência" })).toBeVisible();
    expect(screen.getByText("Nenhuma conferência iniciada ainda.")).toBeVisible();
  });

  it("informa limites e preservação do rascunho antes do envio", () => {
    render(
      <ConferenceUploadPageView
        conference={{ id: "0c8a2252-7229-418d-a478-4a97d568685f", status: "draft", createdAt: "2026-09-14T10:00:00Z" }}
        uploadAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Enviar ficha Unimed" })).toBeVisible();
    expect(screen.getByLabelText("Arquivo da ficha")).toHaveAttribute("accept", "application/pdf,.pdf");
    expect(screen.getByText(/até 10 MB e 10 páginas/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar e iniciar processamento" })).toBeVisible();
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
});

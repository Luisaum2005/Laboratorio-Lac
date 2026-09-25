import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConferenceFinalizationView } from "./conference-finalization-page";

describe("confirmação operacional", () => {
  it("mostra que pedido médico não informado é válido para continuar", () => {
    render(<ConferenceFinalizationView conferenceId="conference-1" blockedReason={null} requestItems={[]} extras={[]} finalizeAction={vi.fn()} />);

    expect(screen.getByText("Pedido médico não informado; nenhum exame desse pedido será incluído.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finalizar e gerar ficha LAC" })).toBeEnabled();
  });

  it("exige confirmação explícita e deixa extras autorizados opcionais", () => {
    render(<ConferenceFinalizationView conferenceId="conference-1" blockedReason={null} requestItems={[{ examId: "10", name: "Hemograma", mnemonic: "HEMO", status: "authorized" }]} extras={[{ examId: "11", name: "Glicemia", mnemonic: "GLI" }]} finalizeAction={vi.fn()} />);

    expect(screen.getByLabelText(/Glicemia/i)).not.toBeChecked();
    expect(screen.getByLabelText(/confiro que revisei/i)).toBeRequired();
    expect(screen.getByRole("button", { name: "Aprovar selecionados e gerar ficha LAC" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Aprovar todos e gerar ficha LAC" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Finalizar sem extras" })).toBeEnabled();
    expect(screen.getByRole("group", { name: "Extras autorizados" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Exames autorizados do pedido" })).toBeVisible();
    expect(screen.getByText("Nenhuma divergência entre o pedido médico e a guia autorizada.")).toBeVisible();
  });

  it("não permite finalizar enquanto a conferência possui pendência", () => {
    render(<ConferenceFinalizationView conferenceId="conference-1" blockedReason="Há exame do pedido médico não autorizado." requestItems={[{ examId: "10", name: "Hemograma", mnemonic: "HEMO", status: "not_authorized" }]} extras={[]} finalizeAction={vi.fn()} />);

    expect(screen.getByText("Há exame do pedido médico não autorizado.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finalizar e gerar ficha LAC" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Divergências" })).toBeVisible();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConferenceFinalizationView } from "./conference-finalization-page";

describe("confirmação operacional", () => {
  it("exige confirmação explícita e deixa extras autorizados opcionais", () => {
    render(<ConferenceFinalizationView conferenceId="conference-1" blockedReason={null} extras={[{ examId: "11", name: "Glicemia", mnemonic: "GLI" }]} finalizeAction={vi.fn()} />);

    expect(screen.getByLabelText(/incluir Glicemia/i)).not.toBeChecked();
    expect(screen.getByLabelText(/confiro que revisei/i)).toBeRequired();
    expect(screen.getByRole("button", { name: "Finalizar e gerar ficha LAC" })).toBeEnabled();
  });

  it("não permite finalizar enquanto a conferência possui pendência", () => {
    render(<ConferenceFinalizationView conferenceId="conference-1" blockedReason="Há exame do pedido médico não autorizado." extras={[]} finalizeAction={vi.fn()} />);

    expect(screen.getByText("Há exame do pedido médico não autorizado.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finalizar e gerar ficha LAC" })).toBeDisabled();
  });
});

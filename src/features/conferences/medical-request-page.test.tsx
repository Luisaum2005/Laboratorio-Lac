import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MedicalRequestView } from "./medical-request-page";

describe("pedido médico opcional", () => {
  it("deixa o pedido opcional e mostra a lista com busca", () => {
    render(
      <MedicalRequestView
        conferenceId="conference-1"
        doctorName={null}
        exams={[{ id: "10", name: "Hemograma", mnemonic: "HEMO" }, { id: "11", name: "Glicemia", mnemonic: "GLI" }]}
        saveAction={vi.fn()}
        removeAction={vi.fn()}
        comparisonBlocked={false}
        items={[{ id: "request-1", examId: "10", examName: "Hemograma", mnemonic: "HEMO", rawText: "Hemograma solicitado", status: "authorized" }]}
      />,
    );

    expect(screen.getByLabelText("Médico solicitante")).not.toBeRequired();
    expect(screen.getByLabelText("Texto do pedido médico")).not.toBeRequired();
    const search = screen.getByRole("searchbox", { name: "Exames do pedido médico" });
    expect(screen.getByRole("checkbox", { name: /Hemograma.*HEMO/i })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Glicemia.*GLI/i })).toBeVisible();
    expect(screen.getByText(/Esta etapa é opcional/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Adicionar .* ao pedido/ })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "hemo" } });
    const examCheckbox = screen.getByRole("checkbox", { name: /Hemograma.*HEMO/i });
    expect(screen.queryByRole("checkbox", { name: /Glicemia.*GLI/i })).not.toBeInTheDocument();
    fireEvent.click(examCheckbox);
    expect(screen.getByText("Hemograma", { selector: ".selected-exam-chip span" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Adicionar 1 exame ao pedido" })).toBeEnabled();
    expect(screen.getByText("Hemograma solicitado").closest("li")).toHaveTextContent("Autorizado");
    expect(screen.getByText(/só é autorizado se constar como autorizado na guia Unimed/i)).toBeVisible();
  });

  it("mantém a comparação globalmente bloqueada enquanto a guia precisa de revisão", () => {
    render(
      <MedicalRequestView
        conferenceId="conference-1"
        doctorName="Dra. Ana"
        exams={[]}
        saveAction={vi.fn()}
        removeAction={vi.fn()}
        comparisonBlocked
        items={[{ id: "request-1", examId: "10", examName: "Hemograma", mnemonic: "HEMO", rawText: "Hemograma solicitado", status: "not_authorized" }]}
      />,
    );

    expect(screen.getByText(/comparação permanece pendente/i)).toBeVisible();
    expect(screen.getByText("Não autorizado pela guia")).toBeVisible();
  });
});

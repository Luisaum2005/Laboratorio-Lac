import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MedicalRequestView } from "./medical-request-page";

describe("pedido médico manual", () => {
  it("exige o médico e deixa explícito o resultado da comparação com a guia", () => {
    render(
      <MedicalRequestView
        conferenceId="conference-1"
        doctorName={null}
        exams={[{ id: "10", name: "Hemograma", mnemonic: "HEMO" }]}
        saveAction={vi.fn()}
        comparisonBlocked={false}
        items={[{ id: "request-1", examId: "10", rawText: "Hemograma solicitado", status: "authorized" }]}
      />,
    );

    expect(screen.getByLabelText("Médico solicitante")).toBeRequired();
    expect(screen.getByLabelText("Texto do pedido")).toBeRequired();
    expect(screen.getByLabelText("Exame do catálogo")).toBeRequired();
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
        comparisonBlocked
        items={[{ id: "request-1", examId: "10", rawText: "Hemograma solicitado", status: "not_authorized" }]}
      />,
    );

    expect(screen.getByText(/comparação do pedido permanece bloqueada/i)).toBeVisible();
    expect(screen.queryByText("Não autorizado")).not.toBeInTheDocument();
  });
});

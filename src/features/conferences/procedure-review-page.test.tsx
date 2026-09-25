import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConferenceProcedureReviewView } from "./procedure-review-page";

describe("revisão de procedimentos na conferência", () => {
  it("mantém o texto bruto e exige uma decisão para a correspondência ausente", () => {
    render(
      <ConferenceProcedureReviewView
        conferenceId="conference-1"
        reviews={[{
          id: "review-1",
          rawText: "99999999 - Texto desconhecido 1 1",
          page: 6,
          code: "99999999",
          description: "Texto desconhecido",
          requestedQuantity: 1,
          authorizedQuantity: 1,
          isAuthorized: true,
          resolution: "needs_review",
          matchedExamId: null,
          resolvedExamId: null,
        }]}
        exams={[{ id: "10", name: "Hemograma completo", mnemonic: "HEMO" }]}
        reviewAction={vi.fn()}
        approveAction={vi.fn()}
        blocked
      />,
    );

    expect(screen.getByRole("heading", { name: "Revisão dos procedimentos" })).toBeVisible();
    const detailsSummary = screen.getByText("Ver detalhes dos exames (1)");
    expect(detailsSummary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(detailsSummary);
    expect(detailsSummary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Texto extraído: 99999999 - Texto desconhecido 1 1")).toBeVisible();
    expect(screen.getByText("Necessita revisão")).toBeVisible();
    expect(screen.getByText(/Não é possível aprovar todos os exames ainda/)).toBeVisible();
    expect(screen.getByText(/Não foi associado a um exame do catálogo/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Aprovar exames (1)" })).toBeDisabled();
    expect(screen.getByLabelText("Exame canônico para Texto desconhecido")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar exame" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Excluir item" })).toBeVisible();
  });

  it("permite aprovar em lote os exames regulares e deixa os detalhes recolhidos", () => {
    render(
      <ConferenceProcedureReviewView
        conferenceId="conference-1"
        reviews={[{
          id: "review-2",
          rawText: "HEMOGRAMA COMPLETO",
          page: 2,
          code: "40304361",
          description: "Hemograma completo",
          requestedQuantity: 1,
          authorizedQuantity: 1,
          isAuthorized: true,
          resolution: "auto_matched",
          matchedExamId: "10",
          resolvedExamId: "10",
        }]}
        exams={[{ id: "10", name: "Hemograma completo", mnemonic: "HEMO" }]}
        reviewAction={vi.fn()}
        approveAction={vi.fn()}
        blocked={false}
      />,
    );

    expect(screen.getByText(/Nenhuma irregularidade encontrada/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Aprovar exames (1)" })).toBeEnabled();
    expect(screen.getByText("Ver detalhes dos exames (1)").closest("details")).not.toHaveAttribute("open");
  });
});

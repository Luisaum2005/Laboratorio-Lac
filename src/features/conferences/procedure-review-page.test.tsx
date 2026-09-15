import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConferenceProcedureReviewView } from "./procedure-review-page";

describe("revisão de procedimentos na conferência", () => {
  it("mantém o texto bruto e exige uma decisão para a correspondência ausente", () => {
    render(
      <ConferenceProcedureReviewView
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
        blocked
      />,
    );

    expect(screen.getByRole("heading", { name: "Revisão dos procedimentos" })).toBeVisible();
    expect(screen.getByText("Texto extraído: 99999999 - Texto desconhecido 1 1")).toBeVisible();
    expect(screen.getByText("Necessita revisão")).toBeVisible();
    expect(screen.getByText(/comparação permanece bloqueada/i)).toBeVisible();
    expect(screen.getByLabelText("Exame canônico para Texto desconhecido")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar exame" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Excluir item" })).toBeVisible();
  });
});

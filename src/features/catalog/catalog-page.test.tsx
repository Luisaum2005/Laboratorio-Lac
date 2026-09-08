import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogPageView } from "./catalog-page";

describe("catálogo de exames", () => {
  it("permite que um funcionário consulte os mnemônicos sem alterar o catálogo", () => {
    render(
      <CatalogPageView
        viewerRole="operator"
        exams={[
          { id: "exam-hm", name: "HEMOGRAMA COMPLETO", mnemonic: "HM" },
          { id: "exam-glic", name: "GLICEMIA", mnemonic: "GLIC" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Catálogo de exames" })).toBeVisible();
    expect(screen.getByText("HEMOGRAMA COMPLETO")).toBeVisible();
    expect(screen.getByText("HM")).toBeVisible();
    expect(screen.getByText("Operador")).toBeVisible();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("identifica o acesso administrativo sem oferecer ações ainda não implementadas", () => {
    render(
      <CatalogPageView
        viewerRole="admin"
        exams={[{ id: "exam-hm", name: "HEMOGRAMA COMPLETO", mnemonic: "HM" }]}
      />,
    );

    expect(screen.getByText("Administrador")).toBeVisible();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });
});

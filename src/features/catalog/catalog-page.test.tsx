import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogPageView } from "./catalog-page";
import { catalogNotice } from "./catalog-notices";

describe("catálogo de exames", () => {
  const noOpAction = async () => {};

  it.each([
    { success: "__proto__" }, { success: "constructor" }, { success: "toString" },
    { error: "__proto__" }, { error: "constructor" }, { error: "toString" },
  ])("ignora parâmetros de mensagem herdados sem quebrar a consulta: %j", (query) => {
    render(<CatalogPageView viewerRole="operator" exams={[]} importMnemonicSpreadsheetAction={noOpAction} notice={catalogNotice(query)} />);
    expect(screen.getByRole("heading", { name: "Catálogo de exames" })).toBeVisible();
  });
  it("permite que um funcionário consulte os mnemônicos sem alterar o catálogo", () => {
    render(
      <CatalogPageView
        viewerRole="operator"
        exams={[
          { id: "exam-hm", name: "HEMOGRAMA COMPLETO", mnemonic: "HM" },
          { id: "exam-glic", name: "GLICEMIA", mnemonic: "GLIC" },
        ]}
        importMnemonicSpreadsheetAction={noOpAction}
      />,
    );

    expect(screen.getByRole("heading", { name: "Catálogo de exames" })).toBeVisible();
    expect(screen.getByText("HEMOGRAMA COMPLETO")).toBeVisible();
    expect(screen.getByText("HM")).toBeVisible();
    expect(screen.getByText("Operador")).toBeVisible();
    expect(screen.getByRole("link", { name: "Consultar HEMOGRAMA COMPLETO" })).toHaveAttribute("href", "/catalogo/exam-hm");
    expect(screen.queryByRole("button", { name: "Adicionar exame" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar mnemônicos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gerenciar/i })).not.toBeInTheDocument();
  });

  it("oferece criação e gerenciamento do catálogo para um administrador", () => {
    render(
      <CatalogPageView
        viewerRole="admin"
        exams={[{ id: "exam-hm", name: "HEMOGRAMA COMPLETO", mnemonic: "HM" }]}
        importMnemonicSpreadsheetAction={noOpAction}
      />,
    );

    expect(screen.getByText("Administrador")).toBeVisible();
    expect(screen.getByRole("group", { name: "Novo exame" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nome do exame" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Mnemônico" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Adicionar exame" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Importar planilha de mnemônicos" })).toBeVisible();
    expect(screen.getByLabelText("Planilha de mnemônicos").getAttribute("accept")).toContain(".xls");
    expect(screen.getByRole("button", { name: "Importar mnemônicos" })).toBeVisible();
    expect(screen.getByLabelText(/entendo que os nomes associados/i)).toBeRequired();
    expect(screen.getByRole("link", { name: "Nova conferência" })).toHaveAttribute("href", "/conferencias");
    expect(screen.getByRole("link", { name: "Gerenciar acessos" })).toHaveAttribute("href", "/acessos");
    expect(screen.getByRole("link", { name: "Gerenciar HEMOGRAMA COMPLETO" })).toHaveAttribute(
      "href",
      "/catalogo/exam-hm",
    );
  });

  it("mostra o resumo da importação do catálogo", () => {
    const notice = catalogNotice({ success: "mnemonics-imported", added: "4", updated: "2", unchanged: "681" });
    expect(notice?.message).toBe("Planilha importada: 4 novos, 2 atualizados e 681 sem alteração.");
  });
});

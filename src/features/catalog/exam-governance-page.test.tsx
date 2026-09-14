import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExamGovernancePageView } from "./exam-governance-page";

describe("manutenção de exame", () => {
  it("permite consultar aliases e componentes sem oferecer mutações ao operador", () => {
    render(
      <ExamGovernancePageView
        viewerRole="operator"
        exam={{ id: "42", name: "HEMOGRAMA COMPLETO", mnemonic: "HM", active: true }}
        aliases={[{ id: "9", alias: "Hemograma" }]}
        components={[{ id: "7", name: "CONTAGEM DE PLAQUETAS", mnemonic: "PLAQ" }]}
        availableComponents={[]}
      />,
    );
    expect(screen.getByText("Hemograma")).toBeVisible();
    expect(screen.getByText("CONTAGEM DE PLAQUETAS (PLAQ)")).toBeVisible();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
  it("oferece ao administrador todas as operações explícitas de governança", () => {
    render(
      <ExamGovernancePageView
        viewerRole="admin"
        exam={{ id: "42", name: "HEMOGRAMA COMPLETO", mnemonic: "HM", active: true }}
        aliases={[{ id: "9", alias: "Hemograma" }]}
        components={[{ id: "7", name: "CONTAGEM DE PLAQUETAS", mnemonic: "PLAQ" }]}
        availableComponents={[
          { id: "8", name: "CONTAGEM DE RETICULÓCITOS", mnemonic: "RETIC" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "HEMOGRAMA COMPLETO" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Editar exame" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar exame" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Desativar exame" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Aliases aprovados" })).toBeVisible();
    expect(screen.getByText("Hemograma")).toBeVisible();
    expect(screen.getByRole("button", { name: "Revogar Hemograma" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Novo alias" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Aprovar alias" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Composição explícita" })).toBeVisible();
    expect(screen.getByText("CONTAGEM DE PLAQUETAS (PLAQ)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remover CONTAGEM DE PLAQUETAS" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Novo componente" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Adicionar componente" })).toBeVisible();
  });
});

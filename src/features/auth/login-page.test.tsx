import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPageView } from "./login-page";

describe("acesso ao sistema", () => {
  it("informa que o acesso é restrito e solicita as credenciais", () => {
    render(<LoginPageView />);

    expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(screen.getByText(/somente usuários convidados/i)).toBeVisible();
  });

  it("explica quando as credenciais são rejeitadas", () => {
    render(<LoginPageView error="E-mail ou senha inválidos." />);

    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });
});

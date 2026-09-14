import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessAdministrationPageView } from "./access-administration-page";

describe("administração de acessos", () => {
  it("permite ao administrador convidar, revogar e consultar a auditoria", () => {
    render(
      <AccessAdministrationPageView
        currentUserId="admin-1"
        users={[
          { id: "admin-1", email: "admin@exemplo.com", role: "admin" },
          { id: "admin-2", email: "segundo-admin@exemplo.com", role: "admin" },
          { id: "user-9", email: "pessoa@exemplo.com", role: "operator" },
        ]}
        events={[{ id: "1", action: "invited", status: "completed", targetEmail: "pessoa@exemplo.com", createdAt: "2026-09-14T10:00:00Z" }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Acessos autorizados" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "E-mail autorizado" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Revogar pessoa@exemplo.com" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Revogar segundo-admin@exemplo.com" })).toBeVisible();
    expect(screen.getByText("Convite enviado para pessoa@exemplo.com")).toBeVisible();
  });
});

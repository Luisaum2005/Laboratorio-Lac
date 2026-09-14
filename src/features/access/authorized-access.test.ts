import { describe, expect, it, vi } from "vitest";

import { inviteAuthorizedEmail, revokeAuthorizedUser } from "./authorized-access";

describe("acessos autorizados", () => {
  it("normaliza o e-mail antes de convidar e registra a auditoria", async () => {
    const invite = vi.fn().mockResolvedValue({ userId: "user-9", error: null });
    const audit = vi.fn().mockResolvedValue({ error: null });

    const result = await inviteAuthorizedEmail(
      { email: "  Pessoa@Exemplo.com ", actorUserId: "admin-1" },
      { invite, targetRole: vi.fn(), administratorCount: vi.fn(), revoke: vi.fn(), audit },
    );

    expect(result).toEqual({ status: "success" });
    expect(invite).toHaveBeenCalledWith("pessoa@exemplo.com");
    expect(audit).toHaveBeenCalledWith({
      action: "invited",
      actorUserId: "admin-1",
      targetEmail: "pessoa@exemplo.com",
      targetUserId: "user-9",
    });
  });

  it("não permite revogar o próprio acesso", async () => {
    const revoke = vi.fn();
    const result = await revokeAuthorizedUser(
      { actorUserId: "admin-1", targetUserId: "admin-1" },
      { invite: vi.fn(), targetRole: vi.fn(), administratorCount: vi.fn(), revoke, audit: vi.fn() },
    );

    expect(result.status).toBe("invalid");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("registra a revogação após remover o acesso", async () => {
    const revoke = vi.fn().mockResolvedValue({ error: null });
    const audit = vi.fn().mockResolvedValue({ error: null });

    const result = await revokeAuthorizedUser(
      { actorUserId: "admin-1", targetUserId: "user-9" },
      { invite: vi.fn(), targetRole: vi.fn().mockResolvedValue({ role: "operator", email: "Pessoa@Exemplo.com", error: null }), administratorCount: vi.fn(), revoke, audit },
    );

    expect(result).toEqual({ status: "success" });
    expect(revoke).toHaveBeenCalledWith("user-9");
    expect(audit).toHaveBeenCalledWith({
      action: "revoked",
      actorUserId: "admin-1",
      targetEmail: "pessoa@exemplo.com",
      targetUserId: "user-9",
    });
  });

  it("não revoga o último administrador", async () => {
    const revoke = vi.fn();
    const result = await revokeAuthorizedUser(
      { actorUserId: "admin-1", targetUserId: "admin-2" },
      {
        invite: vi.fn(),
        targetRole: vi.fn().mockResolvedValue({ role: "admin", email: "admin2@exemplo.com", error: null }),
        administratorCount: vi.fn().mockResolvedValue({ count: 1, error: null }),
        revoke,
        audit: vi.fn(),
      },
    );

    expect(result.status).toBe("invalid");
    expect(revoke).not.toHaveBeenCalled();
  });
});

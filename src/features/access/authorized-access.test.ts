import { describe, expect, it, vi } from "vitest";

import { inviteAuthorizedEmail, revokeAuthorizedUser } from "./authorized-access";

describe("acessos autorizados", () => {
  it("persiste a intenção de auditoria antes de convidar e a conclui após o convite", async () => {
    const sequence: string[] = [];
    const invite = vi.fn().mockImplementation(async () => {
      sequence.push("invite");
      return { userId: "user-9", error: null };
    });
    const createAuditIntent = vi.fn().mockImplementation(async () => {
      sequence.push("intent");
      return { auditId: "audit-9", error: null };
    });
    const completeAuditIntent = vi.fn().mockImplementation(async () => {
      sequence.push("complete");
      return { error: null };
    });

    const result = await inviteAuthorizedEmail(
      { email: "  Pessoa@Exemplo.com ", actorUserId: "admin-1" },
      { invite, targetRole: vi.fn(), administratorCount: vi.fn(), revoke: vi.fn(), createAuditIntent, completeAuditIntent },
    );

    expect(result).toEqual({ status: "success" });
    expect(sequence).toEqual(["intent", "invite", "complete"]);
    expect(invite).toHaveBeenCalledWith("pessoa@exemplo.com");
    expect(createAuditIntent).toHaveBeenCalledWith({
      action: "invited",
      actorUserId: "admin-1",
      targetEmail: "pessoa@exemplo.com",
      targetUserId: null,
    });
    expect(completeAuditIntent).toHaveBeenCalledWith("audit-9", "user-9");
  });

  it("não envia o convite se não puder iniciar a auditoria", async () => {
    const invite = vi.fn();
    const result = await inviteAuthorizedEmail(
      { email: "pessoa@exemplo.com", actorUserId: "admin-1" },
      {
        invite,
        targetRole: vi.fn(),
        administratorCount: vi.fn(),
        revoke: vi.fn(),
        createAuditIntent: vi.fn().mockResolvedValue({ auditId: null, error: "Banco indisponível" }),
        completeAuditIntent: vi.fn(),
      },
    );

    expect(result.status).toBe("error");
    expect(invite).not.toHaveBeenCalled();
  });

  it("não permite revogar o próprio acesso", async () => {
    const revoke = vi.fn();
    const result = await revokeAuthorizedUser(
      { actorUserId: "admin-1", targetUserId: "admin-1" },
      { invite: vi.fn(), targetRole: vi.fn(), administratorCount: vi.fn(), revoke, createAuditIntent: vi.fn(), completeAuditIntent: vi.fn() },
    );

    expect(result.status).toBe("invalid");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("persiste a intenção de auditoria antes de revogar e a conclui após a revogação", async () => {
    const sequence: string[] = [];
    const revoke = vi.fn().mockImplementation(async () => {
      sequence.push("revoke");
      return { error: null };
    });
    const createAuditIntent = vi.fn().mockImplementation(async () => {
      sequence.push("intent");
      return { auditId: "audit-9", error: null };
    });
    const completeAuditIntent = vi.fn().mockImplementation(async () => {
      sequence.push("complete");
      return { error: null };
    });

    const result = await revokeAuthorizedUser(
      { actorUserId: "admin-1", targetUserId: "user-9" },
      { invite: vi.fn(), targetRole: vi.fn().mockResolvedValue({ role: "operator", email: "Pessoa@Exemplo.com", error: null }), administratorCount: vi.fn(), revoke, createAuditIntent, completeAuditIntent },
    );

    expect(result).toEqual({ status: "success" });
    expect(sequence).toEqual(["intent", "revoke", "complete"]);
    expect(revoke).toHaveBeenCalledWith("user-9");
    expect(createAuditIntent).toHaveBeenCalledWith({
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
        createAuditIntent: vi.fn(), completeAuditIntent: vi.fn(),
      },
    );

    expect(result.status).toBe("invalid");
    expect(revoke).not.toHaveBeenCalled();
  });
});

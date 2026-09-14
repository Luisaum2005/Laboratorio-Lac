export type AccessAuditEvent = {
  action: "invited" | "revoked";
  actorUserId: string;
  targetUserId: string;
  targetEmail: string;
};

export type AuthorizedAccessGateway = {
  invite(email: string): Promise<{ userId: string | null; error: string | null }>;
  targetRole(userId: string): Promise<{ role: "admin" | "operator" | null; email: string | null; error: string | null }>;
  administratorCount(): Promise<{ count: number | null; error: string | null }>;
  revoke(userId: string): Promise<{ error: string | null }>;
  audit(event: AccessAuditEvent): Promise<{ error: string | null }>;
};

export type AuthorizedAccessResult =
  | { status: "success" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function inviteAuthorizedEmail(
  input: { email: string; actorUserId: string },
  gateway: AuthorizedAccessGateway,
): Promise<AuthorizedAccessResult> {
  const email = normalizeEmail(input.email);
  if (!input.actorUserId || !isEmail(email)) {
    return { status: "invalid", message: "Informe um e-mail válido." };
  }

  const invitation = await gateway.invite(email);
  if (!invitation.userId || invitation.error) {
    return { status: "error", message: "Não foi possível enviar o convite." };
  }

  const audit = await gateway.audit({
    action: "invited",
    actorUserId: input.actorUserId,
    targetUserId: invitation.userId,
    targetEmail: email,
  });
  return audit.error
    ? { status: "error", message: "O convite foi criado, mas a auditoria falhou." }
    : { status: "success" };
}

export async function revokeAuthorizedUser(
  input: { actorUserId: string; targetUserId: string },
  gateway: AuthorizedAccessGateway,
): Promise<AuthorizedAccessResult> {
  if (!input.actorUserId || !input.targetUserId) {
    return { status: "invalid", message: "Usuário inválido." };
  }
  if (input.actorUserId === input.targetUserId) {
    return { status: "invalid", message: "Você não pode revogar o próprio acesso." };
  }

  const target = await gateway.targetRole(input.targetUserId);
  if (!target.role || !target.email || target.error) {
    return { status: "error", message: "Não foi possível localizar o acesso." };
  }
  if (target.role === "admin") {
    const administrators = await gateway.administratorCount();
    if (administrators.error || administrators.count === null) {
      return { status: "error", message: "Não foi possível validar os administradores." };
    }
    if (administrators.count <= 1) {
      return { status: "invalid", message: "O último administrador não pode ter o acesso revogado." };
    }
  }

  const revoked = await gateway.revoke(input.targetUserId);
  if (revoked.error) {
    return { status: "error", message: "Não foi possível revogar o acesso." };
  }

  const audit = await gateway.audit({
    action: "revoked",
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    targetEmail: normalizeEmail(target.email),
  });
  return audit.error
    ? { status: "error", message: "O acesso foi revogado, mas a auditoria falhou." }
    : { status: "success" };
}

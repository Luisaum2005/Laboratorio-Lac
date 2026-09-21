import Link from "next/link";

type AccessAdministrationPageViewProps = {
  currentUserId: string;
  users: Array<{ id: string; email: string; role: "admin" | "operator" }>;
  events: Array<{ id: string; action: "invited" | "revoked"; status: "pending" | "completed"; targetEmail: string; createdAt: string }>;
  inviteAction?: (formData: FormData) => Promise<void>;
  revokeAction?: (formData: FormData) => Promise<void>;
  rerunRetentionAction?: () => Promise<void>;
  retentionAudits?: Array<{ id: string; actorLabel: string; status: "pending" | "completed" | "failed"; reason: "retention_expired"; createdAt: string }>;
  notice?: { tone: "success" | "error"; message: string };
};

export function AccessAdministrationPageView({
  currentUserId,
  users,
  events,
  inviteAction,
  revokeAction,
  rerunRetentionAction,
  retentionAudits = [],
  notice,
}: AccessAdministrationPageViewProps) {
  return (
    <main className="catalog-shell">
      <Link className="back-link" href="/catalogo">← Voltar ao catálogo</Link>
      <header className="catalog-header">
        <p className="eyebrow">Administração</p>
        <h1>Acessos autorizados</h1>
      </header>
      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      <form className="governance-card" action={inviteAction}>
        <fieldset>
          <legend>Convidar e-mail autorizado</legend>
          <label htmlFor="authorized-email">E-mail autorizado</label>
          <input id="authorized-email" name="email" type="email" autoComplete="email" required />
          <button type="submit">Enviar convite</button>
        </fieldset>
      </form>

      <section className="table-card" aria-labelledby="users-title">
        <h2 id="users-title">Usuários com acesso</h2>
        <table>
          <thead><tr><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Ações</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td><td>{user.role === "admin" ? "Administrador" : "Operador"}</td>
                <td>{user.id !== currentUserId ? (
                  <form action={revokeAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" aria-label={`Revogar ${user.email}`}>Revogar</button>
                  </form>
                ) : "Protegido"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-card" aria-labelledby="audit-title">
        <h2 id="audit-title">Auditoria de acessos</h2>
        <ul className="audit-events">
          {events.map((event) => (
            <li key={event.id}>
              {event.status === "pending" ? "Auditoria pendente para" : event.action === "invited" ? "Convite enviado para" : "Acesso revogado de"} {event.targetEmail}
              <time dateTime={event.createdAt}> — {new Date(event.createdAt).toLocaleString("pt-BR")}</time>
            </li>
          ))}
        </ul>
      </section>

      <section className="table-card" aria-labelledby="retention-title">
        <h2 id="retention-title">Retenção e auditoria</h2>
        <p>Dados clínicos e arquivos vencidos são eliminados após 30 dias. A auditoria preserva somente data, responsável, status e motivo.</p>
        <form action={rerunRetentionAction}>
          <button type="submit">Reprocessar retenção agora</button>
        </form>
        {retentionAudits.length === 0 ? <p className="catalog-count">Nenhuma execução registrada.</p> : (
          <ul className="audit-events">
            {retentionAudits.map((event) => (
              <li key={event.id}>
                {event.status === "completed" ? "Expurgo concluído" : event.status === "failed" ? "Expurgo com falha" : "Expurgo pendente de retomada"} — {event.actorLabel}; motivo: retenção expirada
                <time dateTime={event.createdAt}> — {new Date(event.createdAt).toLocaleString("pt-BR")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

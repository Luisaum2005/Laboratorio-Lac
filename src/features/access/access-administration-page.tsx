import Link from "next/link";

type AccessAdministrationPageViewProps = {
  currentUserId: string;
  users: Array<{ id: string; email: string; role: "admin" | "operator" }>;
  events: Array<{ id: string; action: "invited" | "revoked"; targetEmail: string; createdAt: string }>;
  inviteAction?: (formData: FormData) => Promise<void>;
  revokeAction?: (formData: FormData) => Promise<void>;
  notice?: { tone: "success" | "error"; message: string };
};

export function AccessAdministrationPageView({
  currentUserId,
  users,
  events,
  inviteAction,
  revokeAction,
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
              {event.action === "invited" ? "Convite enviado para" : "Acesso revogado de"} {event.targetEmail}
              <time dateTime={event.createdAt}> — {new Date(event.createdAt).toLocaleString("pt-BR")}</time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

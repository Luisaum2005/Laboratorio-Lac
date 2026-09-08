type LoginPageViewProps = {
  error?: string;
  action?: (formData: FormData) => void | Promise<void>;
};

export function LoginPageView({ error, action }: LoginPageViewProps = {}) {
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          LAC
        </div>
        <p className="eyebrow">Conferência laboratorial</p>
        <h1 id="login-title">Acesso restrito</h1>
        <p className="supporting-copy">
          Entre com as credenciais enviadas pelo laboratório. Somente usuários convidados podem
          acessar o sistema.
        </p>

        {error ? <p role="alert" className="form-error">{error}</p> : null}

        <form className="login-form" action={action}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}

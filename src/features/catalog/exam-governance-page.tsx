import Link from "next/link";

type ExamSummary = {
  id: string;
  name: string;
  mnemonic: string;
};

type ExamGovernancePageViewProps = {
  viewerRole: "operator" | "admin";
  exam: ExamSummary & { active: boolean };
  aliases: Array<{ id: string; alias: string }>;
  tussCodes: string[];
  components: ExamSummary[];
  availableComponents: ExamSummary[];
  updateExamAction?: (formData: FormData) => Promise<void>;
  deactivateExamAction?: (formData: FormData) => Promise<void>;
  approveAliasAction?: (formData: FormData) => Promise<void>;
  revokeAliasAction?: (formData: FormData) => Promise<void>;
  addTussCodeAction?: (formData: FormData) => Promise<void>;
  revokeTussCodeAction?: (formData: FormData) => Promise<void>;
  addCompositionAction?: (formData: FormData) => Promise<void>;
  removeCompositionAction?: (formData: FormData) => Promise<void>;
  notice?: { tone: "success" | "error"; message: string };
};

export function ExamGovernancePageView({
  viewerRole,
  exam,
  aliases,
  tussCodes,
  components,
  availableComponents,
  updateExamAction,
  deactivateExamAction,
  approveAliasAction,
  revokeAliasAction,
  addTussCodeAction,
  revokeTussCodeAction,
  addCompositionAction,
  removeCompositionAction,
  notice,
}: ExamGovernancePageViewProps) {
  return (
    <main className="catalog-shell">
      <Link className="back-link" href="/catalogo">← Voltar ao catálogo</Link>
      <header className="catalog-header">
        <p className="eyebrow">Governança do catálogo</p>
        <h1>{exam.name}</h1>
        <p className="role-badge">{exam.active ? "Ativo" : "Inativo"}</p>
      </header>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      {viewerRole === "admin" ? <form action={updateExamAction} className="governance-card">
        <fieldset>
          <legend>Editar exame</legend>
          <input type="hidden" name="examId" value={exam.id} />
          <div className="form-grid">
            <label htmlFor="exam-name">Nome do exame</label>
            <input id="exam-name" name="name" defaultValue={exam.name} required />
            <label htmlFor="exam-mnemonic">Mnemônico</label>
            <input id="exam-mnemonic" name="mnemonic" defaultValue={exam.mnemonic} required />
          </div>
          <button type="submit">Salvar exame</button>
        </fieldset>
      </form> : null}

      {viewerRole === "admin" && exam.active ? (
        <form action={deactivateExamAction} className="danger-zone">
          <input type="hidden" name="examId" value={exam.id} />
          <button type="submit">Desativar exame</button>
        </form>
      ) : null}

      <fieldset className="governance-card">
        <legend>Códigos TUSS</legend>
        <p>Os códigos associados são usados para preencher a guia final automaticamente.</p>
        <ul>
          {tussCodes.map((code) => (
            <li key={code}>
              <code>{code}</code>
              {viewerRole === "admin" ? <form action={revokeTussCodeAction}>
                <input type="hidden" name="examId" value={exam.id} />
                <input type="hidden" name="tussCode" value={code} />
                <button type="submit" aria-label={`Revogar TUSS ${code}`}>Revogar</button>
              </form> : null}
            </li>
          ))}
        </ul>
        {viewerRole === "admin" ? <form action={addTussCodeAction}>
          <input type="hidden" name="examId" value={exam.id} />
          <label htmlFor="new-tuss-code">Novo código TUSS</label>
          <input id="new-tuss-code" name="tussCode" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required />
          <button type="submit">Associar código TUSS</button>
        </form> : null}
      </fieldset>

      <fieldset className="governance-card">
        <legend>Aliases aprovados</legend>
        <ul>
          {aliases.map((item) => (
            <li key={item.id}>
              <span>{item.alias}</span>
              {viewerRole === "admin" ? <form action={revokeAliasAction}>
                <input type="hidden" name="examId" value={exam.id} />
                <input type="hidden" name="aliasId" value={item.id} />
                <button type="submit" aria-label={`Revogar ${item.alias}`}>
                  Revogar
                </button>
              </form> : null}
            </li>
          ))}
        </ul>
        {viewerRole === "admin" ? <form action={approveAliasAction}>
          <input type="hidden" name="examId" value={exam.id} />
          <label htmlFor="new-alias">Novo alias</label>
          <input id="new-alias" name="alias" required />
          <button type="submit">Aprovar alias</button>
        </form> : null}
      </fieldset>

      <fieldset className="governance-card">
        <legend>Composição explícita</legend>
        <p>Somente os componentes selecionados abaixo fazem parte do pacote.</p>
        <ul>
          {components.map((component) => (
            <li key={component.id}>
              <span>{component.name} ({component.mnemonic})</span>
              {viewerRole === "admin" ? <form action={removeCompositionAction}>
                <input type="hidden" name="packageExamId" value={exam.id} />
                <input type="hidden" name="componentExamId" value={component.id} />
                <button type="submit" aria-label={`Remover ${component.name}`}>
                  Remover
                </button>
              </form> : null}
            </li>
          ))}
        </ul>
        {viewerRole === "admin" ? <form action={addCompositionAction}>
          <input type="hidden" name="packageExamId" value={exam.id} />
          <label htmlFor="new-component">Novo componente</label>
          <select id="new-component" name="componentExamId" required defaultValue="">
            <option value="" disabled>Selecione um exame</option>
            {availableComponents.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name} ({component.mnemonic})
              </option>
            ))}
          </select>
          <button type="submit">Adicionar componente</button>
        </form> : null}
      </fieldset>
    </main>
  );
}

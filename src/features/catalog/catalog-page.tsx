import Link from "next/link";

export type CatalogExam = {
  id: string;
  name: string;
  mnemonic: string;
};

type CatalogPageViewProps = {
  viewerRole: "operator" | "admin";
  exams: CatalogExam[];
  createExamAction?: (formData: FormData) => Promise<void>;
  importMnemonicSpreadsheetAction: (formData: FormData) => Promise<void>;
  notice?: { tone: "success" | "error"; message: string };
};

export function CatalogPageView({
  viewerRole,
  exams,
  createExamAction,
  importMnemonicSpreadsheetAction,
  notice,
}: CatalogPageViewProps) {
  return (
    <main className="catalog-shell">
      <header className="catalog-header">
        <p className="eyebrow">Laboratório LAC</p>
        <h1>Catálogo de exames</h1>
        <p className="role-badge">{viewerRole === "admin" ? "Administrador" : "Operador"}</p>
        <Link className="action-link" href="/conferencias">Nova conferência</Link>
        {viewerRole === "admin" ? <Link className="action-link action-link--secondary" href="/acessos">Gerenciar acessos</Link> : null}
      </header>

      {notice ? <p className={`notice notice-${notice.tone}`}>{notice.message}</p> : null}

      {viewerRole === "admin" ? (
        <>
          <form action={createExamAction} className="governance-card">
            <fieldset>
              <legend>Novo exame</legend>
              <div className="form-grid">
                <label htmlFor="new-exam-name">Nome do exame</label>
                <input id="new-exam-name" name="name" required />
                <label htmlFor="new-exam-mnemonic">Mnemônico</label>
                <input id="new-exam-mnemonic" name="mnemonic" required />
              </div>
              <button type="submit">Adicionar exame</button>
            </fieldset>
          </form>

          <section className="governance-card mnemonic-import-card" aria-labelledby="mnemonic-import-heading">
            <div>
              <h2 id="mnemonic-import-heading">Importar planilha de mnemônicos</h2>
              <p>Use uma planilha Excel 2003 XML (.xls), com as colunas “Mnemônico” e “Descrição”. Mnemônicos existentes atualizam o nome do exame. Exames ausentes na planilha, aliases e códigos TUSS não são removidos nem alterados.</p>
            </div>
            <form action={importMnemonicSpreadsheetAction} className="mnemonic-import-form">
              <label htmlFor="mnemonic-spreadsheet">Planilha de mnemônicos</label>
              <input id="mnemonic-spreadsheet" name="mnemonicSpreadsheet" type="file" accept=".xls,.xml,application/vnd.ms-excel,text/xml" required />
              <label className="mnemonic-import-confirmation">
                <input type="checkbox" name="confirmMnemonicImport" value="yes" required />
                Entendo que os nomes associados aos mnemônicos existentes poderão ser atualizados.
              </label>
              <button type="submit">Importar mnemônicos</button>
            </form>
          </section>
        </>
      ) : null}

      <div className="table-card">
        <p className="catalog-count">{exams.length} exames ativos</p>
        <table>
          <thead>
            <tr>
              <th scope="col">Exame</th>
              <th scope="col">Mnemônico</th>
              <th scope="col">{viewerRole === "admin" ? "Ações" : "Detalhes"}</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td>{exam.name}</td>
                <td><code>{exam.mnemonic}</code></td>
                <td>
                  <Link className="action-link action-link--secondary action-link--compact" href={`/catalogo/${exam.id}`}>
                    {viewerRole === "admin" ? "Gerenciar" : "Consultar"} {exam.name}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

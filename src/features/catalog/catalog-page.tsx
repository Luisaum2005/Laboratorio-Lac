export type CatalogExam = {
  id: string;
  name: string;
  mnemonic: string;
};

type CatalogPageViewProps = {
  viewerRole: "operator" | "admin";
  exams: CatalogExam[];
};

export function CatalogPageView({ viewerRole, exams }: CatalogPageViewProps) {
  return (
    <main>
      <header>
        <p>Laboratório LAC</p>
        <h1>Catálogo de exames</h1>
        <p>{viewerRole === "admin" ? "Administrador" : "Operador"}</p>
      </header>

      <table>
        <thead>
          <tr>
            <th scope="col">Exame</th>
            <th scope="col">Mnemônico</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id}>
              <td>{exam.name}</td>
              <td>{exam.mnemonic}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

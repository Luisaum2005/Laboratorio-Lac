import { describe, expect, it } from "vitest";

import { readCanonicalExams, SpreadsheetCatalogError } from "./spreadsheet-catalog";

describe("importação do catálogo canônico", () => {
  it("preserva cada mnemônico quando descrições são iguais", () => {
    const spreadsheet = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="Plan1"><Table>
          <Row><Cell><Data ss:Type="String">Mnemônico</Data></Cell><Cell><Data ss:Type="String">Descrição</Data></Cell></Row>
          <Row><Cell><Data ss:Type="String">LINF</Data></Cell><Cell><Data ss:Type="String">CD4 E CD8 + CD3</Data></Cell></Row>
          <Row><Cell><Data ss:Type="String">CD3</Data></Cell><Cell><Data ss:Type="String">CD4 E CD8 + CD3</Data></Cell></Row>
        </Table></Worksheet>
      </Workbook>`;

    expect(readCanonicalExams(spreadsheet)).toEqual([
      { mnemonic: "LINF", name: "CD4 E CD8 + CD3" },
      { mnemonic: "CD3", name: "CD4 E CD8 + CD3" },
    ]);
  });

  it("ignora linhas vazias e normaliza cabeçalhos e mnemônicos", () => {
    const spreadsheet = `<Workbook><Worksheet><Table>
      <Row><Cell><Data>Mnemônico</Data></Cell><Cell><Data>Descrição</Data></Cell></Row>
      <Row><Cell><Data> hemO </Data></Cell><Cell><Data> Hemograma </Data></Cell></Row>
      <Row><Cell><Data></Data></Cell><Cell><Data></Data></Cell></Row>
    </Table></Worksheet></Workbook>`;

    expect(readCanonicalExams(spreadsheet)).toEqual([{ mnemonic: "HEMO", name: "Hemograma" }]);
  });

  it("rejeita cabeçalhos inesperados, linhas incompletas e mnemônicos ambíguos", () => {
    const headerError = `<Workbook><Worksheet><Table><Row><Cell><Data>Código</Data></Cell><Cell><Data>Nome</Data></Cell></Row></Table></Worksheet></Workbook>`;
    const incompleteRow = `<Workbook><Worksheet><Table><Row><Cell><Data>Mnemônico</Data></Cell><Cell><Data>Descrição</Data></Cell></Row><Row><Cell><Data>HM</Data></Cell></Row></Table></Worksheet></Workbook>`;
    const duplicateMnemonic = `<Workbook><Worksheet><Table><Row><Cell><Data>Mnemônico</Data></Cell><Cell><Data>Descrição</Data></Cell></Row><Row><Cell><Data>HM</Data></Cell><Cell><Data>Hemograma</Data></Cell></Row><Row><Cell><Data>HM</Data></Cell><Cell><Data>Hemograma completo</Data></Cell></Row></Table></Worksheet></Workbook>`;

    expect(() => readCanonicalExams(headerError)).toThrow(SpreadsheetCatalogError);
    expect(() => readCanonicalExams(incompleteRow)).toThrow("invalid_row");
    expect(() => readCanonicalExams(duplicateMnemonic)).toThrow("duplicate_mnemonic");
  });

  it("bloqueia declarações externas e entidades personalizadas", () => {
    const spreadsheet = `<!DOCTYPE Workbook [<!ENTITY x SYSTEM "file:///etc/passwd">]><Workbook/>`;
    expect(() => readCanonicalExams(spreadsheet)).toThrow("invalid_format");
  });
});

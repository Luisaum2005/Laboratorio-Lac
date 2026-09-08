import { describe, expect, it } from "vitest";

import { readCanonicalExams } from "./spreadsheet-catalog";

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
});

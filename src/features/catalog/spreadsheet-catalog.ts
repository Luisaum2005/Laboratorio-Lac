import { XMLParser } from "fast-xml-parser";

export type CanonicalExam = {
  mnemonic: string;
  name: string;
};

type XmlValue = string | number | { "#text"?: string | number } | undefined;

function text(value: XmlValue): string {
  if (value === undefined) return "";
  if (typeof value === "object") return String(value["#text"] ?? "").trim();
  return String(value).trim();
}

export function readCanonicalExams(spreadsheetXml: string): CanonicalExam[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
    isArray: (_name, path) => {
      const currentPath = String(path);
      return currentPath === "Workbook.Worksheet.Table.Row" || currentPath.endsWith(".Row.Cell");
    },
  });

  const workbook = parser.parse(spreadsheetXml) as {
    Workbook?: {
      Worksheet?: { Table?: { Row?: Array<{ Cell?: Array<{ Data?: XmlValue }> }> } };
    };
  };
  const rows = workbook.Workbook?.Worksheet?.Table?.Row ?? [];

  return rows
    .map((row) => {
      const cells = row.Cell ?? [];
      return {
        mnemonic: text(cells[0]?.Data),
        name: text(cells[1]?.Data),
      };
    })
    .filter(
      (exam) =>
        exam.mnemonic.length > 0 &&
        exam.name.length > 0 &&
        exam.mnemonic.toLocaleLowerCase("pt-BR") !== "mnemônico",
    );
}

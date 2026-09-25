import { XMLParser, XMLValidator } from "fast-xml-parser";

export type CanonicalExam = {
  mnemonic: string;
  name: string;
};

type XmlValue = string | number | { "#text"?: string | number } | undefined;

export class SpreadsheetCatalogError extends Error {
  readonly reason: "invalid_format" | "invalid_row" | "duplicate_mnemonic";

  constructor(reason: "invalid_format" | "invalid_row" | "duplicate_mnemonic") {
    super(reason);
    this.reason = reason;
  }
}

function text(value: XmlValue): string {
  if (value === undefined) return "";
  if (typeof value === "object") return String(value["#text"] ?? "").trim();
  return String(value).trim();
}

function normalizedHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function decodeSpreadsheetBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ");
  }
}

export function readCanonicalExams(spreadsheetXml: string): CanonicalExam[] {
  if (spreadsheetXml.length === 0 || /<!DOCTYPE|<!ENTITY/i.test(spreadsheetXml)) {
    throw new SpreadsheetCatalogError("invalid_format");
  }

  const validation = XMLValidator.validate(spreadsheetXml);
  if (validation !== true) throw new SpreadsheetCatalogError("invalid_format");

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
      Worksheet?: { Table?: { Row?: Array<{ Cell?: Array<{ Data?: XmlValue }> }> } | Array<{ Table?: { Row?: Array<{ Cell?: Array<{ Data?: XmlValue }> }> } }> };
    };
  };
  const worksheet = workbook.Workbook?.Worksheet;
  const firstWorksheet = Array.isArray(worksheet) ? worksheet[0] : worksheet;
  const rows = firstWorksheet?.Table?.Row ?? [];
  const headerCells = rows[0]?.Cell ?? [];

  if (
    normalizedHeader(text(headerCells[0]?.Data)) !== "mnemonico" ||
    normalizedHeader(text(headerCells[1]?.Data)) !== "descricao"
  ) {
    throw new SpreadsheetCatalogError("invalid_format");
  }

  const exams: CanonicalExam[] = [];
  const seen = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const cells = row.Cell ?? [];
    const rawMnemonic = text(cells[0]?.Data);
    const name = text(cells[1]?.Data);
    if (!rawMnemonic && !name) continue;
    if (!rawMnemonic || !name) throw new SpreadsheetCatalogError("invalid_row");

    const mnemonic = rawMnemonic.toLocaleUpperCase("pt-BR");
    const existingName = seen.get(mnemonic);
    if (existingName !== undefined) {
      if (existingName !== name) throw new SpreadsheetCatalogError("duplicate_mnemonic");
      continue;
    }

    seen.set(mnemonic, name);
    exams.push({ mnemonic, name });
  }

  if (exams.length === 0) throw new SpreadsheetCatalogError("invalid_format");
  return exams;
}

export function readCanonicalExamsFromBytes(bytes: Uint8Array): CanonicalExam[] {
  return readCanonicalExams(decodeSpreadsheetBytes(bytes));
}

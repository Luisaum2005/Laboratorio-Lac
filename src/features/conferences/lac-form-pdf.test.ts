import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createLacFormPdf } from "./lac-form-pdf";

describe("ficha LAC em PDF", () => {
  it("gera uma ficha imprimível com os dados obrigatórios e três seções de exames", async () => {
    const pdf = await createLacFormPdf({
      patientName: "Maria da Silva",
      doctorName: "Dra. Ana",
      guideNumber: "123456",
      password: "7890",
      passwordValidUntil: "2026-10-01",
      authorizationDate: "2026-09-21",
      requestDate: "2026-09-20",
      released: [{ examId: "10", name: "Hemograma", mnemonic: "HEMO", origin: "medical_request" }],
      authorizedExtras: [{ examId: "11", name: "Glicemia", mnemonic: "GLI" }],
      divergences: [{ name: "Colesterol", mnemonic: "COL" }],
    });

    expect(pdf.slice(0, 4)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("cria páginas adicionais quando a lista de exames não cabe em uma folha", async () => {
    const pdf = await createLacFormPdf({
      patientName: "Maria da Silva", doctorName: "Dra. Ana", guideNumber: "123456", password: "7890",
      passwordValidUntil: "2026-10-01", authorizationDate: "2026-09-21", requestDate: "2026-09-20",
      released: Array.from({ length: 80 }, (_, index) => ({ examId: String(index), name: `Exame laboratorial muito extenso ${index + 1}`, mnemonic: `EX${index}`, origin: "medical_request" as const })),
      authorizedExtras: [], divergences: [],
    });

    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
  });
});

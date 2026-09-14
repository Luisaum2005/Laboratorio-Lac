import { describe, expect, it, vi } from "vitest";

import { startConferenceProcessing } from "./conference-upload";

const onePagePdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);

describe("início seguro da conferência", () => {
  it("recusa arquivos que não são PDF antes de iniciar o upload", async () => {
    const upload = vi.fn();

    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.png", type: "image/png", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn(),
      upload,
      recordUpload: vi.fn(),
      removeUpload: vi.fn(),
      createSignedUrl: vi.fn(),
      requestProcessing: vi.fn(),
    });

    expect(result).toEqual({ status: "invalid", reason: "not_pdf" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("mantém o rascunho sem upload quando o PDF ultrapassa dez páginas", async () => {
    const upload = vi.fn();

    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.pdf", type: "application/pdf", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn().mockResolvedValue(11),
      upload,
      recordUpload: vi.fn(),
      removeUpload: vi.fn(),
      createSignedUrl: vi.fn(),
      requestProcessing: vi.fn(),
    });

    expect(result).toEqual({ status: "invalid", reason: "too_many_pages" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("envia ao bucket privado e solicita o processamento por URL assinada breve", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const recordUpload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ signedUrl: "https://storage.test/signed", error: null });
    const requestProcessing = vi.fn().mockResolvedValue({ status: "processing", error: null });

    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.pdf", type: "application/pdf", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn().mockResolvedValue(1),
      upload,
      recordUpload,
      removeUpload: vi.fn(),
      createSignedUrl,
      requestProcessing,
    });

    expect(result).toEqual({ status: "processing" });
    expect(upload).toHaveBeenCalledWith("0c8a2252-7229-418d-a478-4a97d568685f/original.pdf", onePagePdf);
    expect(recordUpload).toHaveBeenCalledWith("0c8a2252-7229-418d-a478-4a97d568685f/original.pdf");
    expect(createSignedUrl).toHaveBeenCalledWith("0c8a2252-7229-418d-a478-4a97d568685f/original.pdf", 300);
    expect(requestProcessing).toHaveBeenCalledWith("https://storage.test/signed");
  });

  it("preserva o rascunho quando o armazenamento falha", async () => {
    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.pdf", type: "application/pdf", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn().mockResolvedValue(1),
      upload: vi.fn().mockResolvedValue({ error: "Storage indisponível" }),
      recordUpload: vi.fn(),
      removeUpload: vi.fn(),
      createSignedUrl: vi.fn(),
      requestProcessing: vi.fn(),
    });

    expect(result).toEqual({ status: "error", reason: "upload_failed" });
  });

  it("remove o objeto privado se não conseguir vinculá-lo ao rascunho", async () => {
    const removeUpload = vi.fn().mockResolvedValue(undefined);
    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.pdf", type: "application/pdf", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn().mockResolvedValue(1),
      upload: vi.fn().mockResolvedValue({ error: null }),
      recordUpload: vi.fn().mockResolvedValue({ error: "Banco indisponível" }),
      removeUpload,
      createSignedUrl: vi.fn(),
      requestProcessing: vi.fn(),
    });

    expect(result).toEqual({ status: "error", reason: "upload_record_failed" });
    expect(removeUpload).toHaveBeenCalledWith("0c8a2252-7229-418d-a478-4a97d568685f/original.pdf");
  });

  it("mantém o arquivo vinculado ao rascunho enquanto aguarda o serviço Python", async () => {
    const result = await startConferenceProcessing({
      conferenceId: "0c8a2252-7229-418d-a478-4a97d568685f",
      file: { name: "ficha.pdf", type: "application/pdf", size: 120, bytes: onePagePdf },
    }, {
      getPdfPageCount: vi.fn().mockResolvedValue(1),
      upload: vi.fn().mockResolvedValue({ error: null }),
      recordUpload: vi.fn().mockResolvedValue({ error: null }),
      removeUpload: vi.fn(),
      createSignedUrl: vi.fn().mockResolvedValue({ signedUrl: "https://storage.test/signed", error: null }),
      requestProcessing: vi.fn().mockResolvedValue({ status: "awaiting_processing", error: null }),
    });

    expect(result).toEqual({ status: "awaiting_processing" });
  });
});

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
export const PROCESSING_URL_TTL_SECONDS = 300;

export type ConferenceUploadFile = {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
};

export type ConferenceUploadGateway = {
  getPdfPageCount(bytes: Uint8Array): Promise<number>;
  upload(objectPath: string, bytes: Uint8Array): Promise<{ error: string | null }>;
  recordUpload(objectPath: string): Promise<{ error: string | null }>;
  removeUpload(objectPath: string): Promise<void>;
  createSignedUrl(objectPath: string, expiresInSeconds: number): Promise<{ signedUrl: string | null; error: string | null }>;
  requestProcessing(signedUrl: string): Promise<{ status: "processing" | "awaiting_processing"; error: string | null }>;
};

export type ConferenceUploadResult =
  | { status: "processing" }
  | { status: "awaiting_processing" }
  | { status: "invalid"; reason: "not_pdf" | "too_large" | "invalid_pdf" | "too_many_pages" }
  | { status: "error"; reason: "upload_failed" | "upload_record_failed" | "processing_unavailable" };

export type ConferenceProcessingGateway = Pick<ConferenceUploadGateway, "createSignedUrl" | "requestProcessing">;

export async function requestConferenceProcessing(
  objectPath: string,
  gateway: ConferenceProcessingGateway,
): Promise<ConferenceUploadResult> {
  const signed = await gateway.createSignedUrl(objectPath, PROCESSING_URL_TTL_SECONDS);
  if (signed.error || !signed.signedUrl) return { status: "error", reason: "processing_unavailable" };

  const request = await gateway.requestProcessing(signed.signedUrl);
  if (request.error) return { status: "error", reason: "processing_unavailable" };

  return { status: request.status };
}

function hasPdfHeader(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

function isPdf(file: ConferenceUploadFile) {
  return file.type === "application/pdf"
    && file.name.toLocaleLowerCase("pt-BR").endsWith(".pdf")
    && hasPdfHeader(file.bytes);
}

export async function startConferenceProcessing(
  input: { conferenceId: string; file: ConferenceUploadFile },
  gateway: ConferenceUploadGateway,
): Promise<ConferenceUploadResult> {
  if (!isPdf(input.file)) return { status: "invalid", reason: "not_pdf" };
  if (input.file.size <= 0 || input.file.size > MAX_PDF_BYTES) return { status: "invalid", reason: "too_large" };

  let pageCount: number;
  try {
    pageCount = await gateway.getPdfPageCount(input.file.bytes);
  } catch {
    return { status: "invalid", reason: "invalid_pdf" };
  }

  if (!Number.isInteger(pageCount) || pageCount < 1) return { status: "invalid", reason: "invalid_pdf" };
  if (pageCount > MAX_PDF_PAGES) return { status: "invalid", reason: "too_many_pages" };

  const objectPath = `${input.conferenceId}/original.pdf`;
  const upload = await gateway.upload(objectPath, input.file.bytes);
  if (upload.error) return { status: "error", reason: "upload_failed" };
  const record = await gateway.recordUpload(objectPath);
  if (record.error) {
    await gateway.removeUpload(objectPath);
    return { status: "error", reason: "upload_record_failed" };
  }

  return requestConferenceProcessing(objectPath, gateway);
}

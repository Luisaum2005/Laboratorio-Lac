"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requestConferenceProcessing, startConferenceProcessing } from "./conference-upload";
import { createProcedureReviewStoreGateway } from "./procedure-review-gateway";
import { decideProcedureReview } from "./procedure-review-decision";
import { persistInitialProcedureReviews } from "./procedure-review-store";

const CONFERENCE_BUCKET = "unimed-guides";

type ParserResult = {
  status: "ok" | "reading_unavailable";
  reason?: "text_unavailable" | "unexpected_layout";
  metadata?: Record<string, string | null>;
  procedures?: Array<{
    raw_text: string;
    page: number;
    code: string;
    description: string;
    requested_quantity: number;
    authorized_quantity: number;
    is_authorized: boolean;
  }>;
};

function isParserResult(value: unknown): value is ParserResult {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  return value.status === "ok" || value.status === "reading_unavailable";
}

async function currentOperatorId() {
  const requester = await createSupabaseServerClient();
  const { data } = await requester.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: profile } = await requester.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!profile) redirect("/login");
  return String(userId);
}

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isExamId(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

async function syncProcedureReviewCompletion(conferenceId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { count, error: countError } = await admin.from("conference_procedure_reviews")
    .select("id", { count: "exact", head: true }).eq("conference_id", conferenceId).eq("resolution", "needs_review");
  if (countError) return countError.message;
  const { data, error } = await admin.from("conferences").update({
    procedure_review_completed_at: count === 0 ? new Date().toISOString() : null,
  }).eq("id", conferenceId).eq("created_by", userId).select("id").maybeSingle();
  return error?.message ?? (data ? null : "A conferência não está mais disponível.");
}

async function dispatchConferenceProcessing(
  conferenceId: string,
  userId: string,
  signedUrl: string,
) {
  const admin = createSupabaseAdminClient();
  const processorUrl = process.env.PDF_PROCESSOR_URL;
  const processorSecret = process.env.PDF_PROCESSOR_SHARED_SECRET;
  let parserResult: ParserResult;
  if (processorUrl) {
    if (!processorSecret) return { status: "awaiting_processing" as const, error: null };
    try {
      const response = await fetch(processorUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${processorSecret}`, "content-type": "application/json" },
        body: JSON.stringify({ conferenceId, sourceUrl: signedUrl }),
      });
      if (!response.ok) return { status: "awaiting_processing" as const, error: "O serviço de processamento não respondeu." };
      const responseBody: unknown = await response.json();
      if (!isParserResult(responseBody)) {
        return { status: "awaiting_processing" as const, error: "O serviço de processamento retornou um resultado inválido." };
      }
      parserResult = responseBody;
    } catch {
      return { status: "awaiting_processing" as const, error: "O serviço de processamento está indisponível." };
    }
  } else {
    return { status: "awaiting_processing" as const, error: null };
  }

  const { error } = await admin.from("conferences").update({
    processing_requested_at: new Date().toISOString(),
    extraction_completed_at: new Date().toISOString(),
    extraction_result: parserResult,
    status: "processing",
  }).eq("id", conferenceId).eq("created_by", userId);
  if (error) return { status: "processing" as const, error: error.message };

  const persistence = await persistInitialProcedureReviews(
    conferenceId,
    (parserResult.procedures ?? []).map((procedure) => ({
      rawText: procedure.raw_text,
      page: procedure.page,
      code: procedure.code,
      description: procedure.description,
      requestedQuantity: procedure.requested_quantity,
      authorizedQuantity: procedure.authorized_quantity,
      isAuthorized: procedure.is_authorized,
    })),
    createProcedureReviewStoreGateway(admin),
  );
  if (persistence.status === "error") return { status: "processing" as const, error: persistence.message };
  if (parserResult.status === "reading_unavailable") return { status: "processing" as const, error: null };

  const completionError = await syncProcedureReviewCompletion(conferenceId, userId);
  return { status: "processing" as const, error: completionError };
}

export async function createConferenceDraftAction() {
  const userId = await currentOperatorId();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("conferences").insert({ created_by: userId }).select("id").single();
  if (error || !data) throw new Error("Não foi possível criar o rascunho da conferência.");
  revalidatePath("/conferencias");
  redirect(`/conferencias/${data.id}`);
}

export async function uploadConferenceFileAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");

  const admin = createSupabaseAdminClient();
  const { data: conference, error: conferenceError } = await admin
    .from("conferences").select("id,status").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (conferenceError || !conference) redirect("/conferencias?error=not_found");
  if (conference.status !== "draft") redirect(`/conferencias/${conferenceId}`);

  const sourceFile = formData.get("sourceFile");
  if (!(sourceFile instanceof File)) redirect(`/conferencias/${conferenceId}?error=not_pdf`);
  const bytes = new Uint8Array(await sourceFile.arrayBuffer());
  const result = await startConferenceProcessing({
    conferenceId,
    file: { name: sourceFile.name, type: sourceFile.type, size: sourceFile.size, bytes },
  }, {
    getPdfPageCount: async (documentBytes) => (await PDFDocument.load(documentBytes)).getPageCount(),
    upload: async (objectPath, documentBytes) => {
      const { error } = await admin.storage.from(CONFERENCE_BUCKET).upload(objectPath, documentBytes, {
        contentType: "application/pdf", upsert: true,
      });
      return { error: error?.message ?? null };
    },
    recordUpload: async (objectPath) => {
      const { data, error } = await admin.from("conferences").update({
        source_file_path: objectPath,
        source_file_uploaded_at: new Date().toISOString(),
      }).eq("id", conferenceId).eq("created_by", userId).eq("status", "draft").select("id").maybeSingle();
      return { error: error?.message ?? (data ? null : "O rascunho não está mais disponível.") };
    },
    removeUpload: async (objectPath) => {
      await admin.storage.from(CONFERENCE_BUCKET).remove([objectPath]);
    },
    createSignedUrl: async (objectPath, expiresInSeconds) => {
      const { data, error } = await admin.storage.from(CONFERENCE_BUCKET).createSignedUrl(objectPath, expiresInSeconds);
      return { signedUrl: data?.signedUrl ?? null, error: error?.message ?? null };
    },
    requestProcessing: (signedUrl) => dispatchConferenceProcessing(conferenceId, userId, signedUrl),
  });
  if (result.status === "invalid" || result.status === "error") redirect(`/conferencias/${conferenceId}?error=${result.reason}`);
  revalidatePath("/conferencias");
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=${result.status}`);
}

export async function retryConferenceProcessingAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");

  const admin = createSupabaseAdminClient();
  const { data: conference, error } = await admin.from("conferences")
    .select("status,source_file_path").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (error || !conference || conference.status !== "draft" || !conference.source_file_path) {
    redirect(`/conferencias/${conferenceId}?error=not_found`);
  }

  const result = await requestConferenceProcessing(conference.source_file_path, {
    createSignedUrl: async (objectPath, expiresInSeconds) => {
      const { data, error: signedError } = await admin.storage.from(CONFERENCE_BUCKET).createSignedUrl(objectPath, expiresInSeconds);
      return { signedUrl: data?.signedUrl ?? null, error: signedError?.message ?? null };
    },
    requestProcessing: (signedUrl) => dispatchConferenceProcessing(conferenceId, userId, signedUrl),
  });
  if (result.status === "error") redirect(`/conferencias/${conferenceId}?error=${result.reason}`);

  revalidatePath("/conferencias");
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=${result.status}`);
}

export async function reviewConferenceProcedureAction(formData: FormData) {
  const userId = await currentOperatorId();
  const reviewId = formData.get("reviewId");
  if (!isUuid(reviewId)) redirect("/conferencias?error=not_found");

  const decision = formData.get("decision");
  if (decision !== "confirm" && decision !== "exclude") redirect("/conferencias?error=review_invalid");

  const admin = createSupabaseAdminClient();
  const { data: review, error: reviewError } = await admin.from("conference_procedure_reviews")
    .select("id,conference_id,matched_exam_id").eq("id", reviewId).maybeSingle();
  if (reviewError || !review) redirect("/conferencias?error=not_found");

  const { data: conference, error: conferenceError } = await admin.from("conferences")
    .select("id").eq("id", review.conference_id).eq("created_by", userId).maybeSingle();
  if (conferenceError || !conference) redirect("/conferencias?error=not_found");

  let selectedExamId: string | null = null;
  let compositions: Array<{ packageExamId: string; componentExamId: string }> = [];
  if (decision === "confirm") {
    const examId = formData.get("examId");
    if (!isExamId(examId)) redirect(`/conferencias/${conference.id}?error=review_invalid`);
    const { data: exam, error: examError } = await admin.from("exams")
      .select("id").eq("id", examId).eq("active", true).maybeSingle();
    if (examError || !exam) redirect(`/conferencias/${conference.id}?error=review_invalid`);
    selectedExamId = String(exam.id);
    const { data: compositionRows, error: compositionsError } = await admin.from("exam_compositions")
      .select("package_exam_id,component_exam_id").eq("package_exam_id", exam.id);
    if (compositionsError) redirect(`/conferencias/${conference.id}?error=review_update_failed`);
    compositions = (compositionRows ?? []).map((composition) => ({
      packageExamId: String(composition.package_exam_id),
      componentExamId: String(composition.component_exam_id),
    }));
  }

  const resolved = decideProcedureReview({
    decision,
    selectedExamId,
    matchedExamId: review.matched_exam_id === null ? null : String(review.matched_exam_id),
  }, compositions);
  if (resolved.status === "invalid") redirect(`/conferencias/${conference.id}?error=review_invalid`);

  const { data: updated, error: updateError } = await admin.from("conference_procedure_reviews").update({
    resolution: resolved.resolution,
    resolved_exam_id: resolved.resolvedExamId,
    expanded_exam_ids: resolved.expandedExamIds,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", review.id).eq("conference_id", conference.id).select("id").maybeSingle();
  if (updateError || !updated) redirect(`/conferencias/${conference.id}?error=review_update_failed`);

  const completionError = await syncProcedureReviewCompletion(String(conference.id), userId);
  if (completionError) redirect(`/conferencias/${conference.id}?error=review_update_failed`);

  revalidatePath(`/conferencias/${conference.id}`);
  redirect(`/conferencias/${conference.id}?success=review_updated`);
}

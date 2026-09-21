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
import { prepareManualProcedure } from "./manual-procedure";
import { expandExplicitComposition, normalizeProcedureText } from "./procedure-review";
import { compareMedicalRequest } from "./medical-request-comparison";
import { prepareConferenceFinalization } from "./conference-finalization";
import { createLacFormPdf } from "./lac-form-pdf";

const CONFERENCE_BUCKET = "unimed-guides";
const LAC_FORMS_BUCKET = "lac-forms";

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

export async function addManualProcedureAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  const manualText = formData.get("manualText");
  const prepared = prepareManualProcedure({
    examId: String(formData.get("examId") ?? ""),
    requestedQuantity: String(formData.get("requestedQuantity") ?? ""),
    authorizedQuantity: String(formData.get("authorizedQuantity") ?? ""),
  });
  if (!isUuid(conferenceId) || typeof manualText !== "string" || !manualText.trim() || prepared.status === "invalid") {
    redirect(`/conferencias/${typeof conferenceId === "string" ? conferenceId : ""}?error=manual_invalid`);
  }

  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences")
    .select("id,extraction_result").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isParserResult(conference.extraction_result) || conference.extraction_result.status !== "reading_unavailable") {
    redirect(`/conferencias/${conferenceId}?error=manual_unavailable`);
  }
  const { data: exam } = await admin.from("exams").select("id,name").eq("id", prepared.procedure.examId).eq("active", true).maybeSingle();
  if (!exam) redirect(`/conferencias/${conferenceId}?error=manual_invalid`);
  const { data: latest } = await admin.from("conference_procedure_reviews").select("source_index")
    .eq("conference_id", conferenceId).order("source_index", { ascending: false }).limit(1).maybeSingle();
  const { data: compositions } = await admin.from("exam_compositions").select("package_exam_id,component_exam_id").eq("package_exam_id", exam.id);
  const isAuthorized = prepared.procedure.isAuthorized;
  const { error } = await admin.from("conference_procedure_reviews").insert({
    conference_id: conferenceId, source_index: (latest?.source_index ?? -1) + 1,
    raw_text: manualText.trim(), normalized_text: normalizeProcedureText(manualText), source_page: null, procedure_code: null,
    procedure_description: exam.name, requested_quantity: prepared.procedure.requestedQuantity,
    authorized_quantity: prepared.procedure.authorizedQuantity, is_authorized: isAuthorized,
    resolution: isAuthorized ? "confirmed" : "excluded", matched_exam_id: null,
    resolved_exam_id: isAuthorized ? exam.id : null,
    expanded_exam_ids: isAuthorized ? expandExplicitComposition(String(exam.id), (compositions ?? []).map((row) => ({ packageExamId: String(row.package_exam_id), componentExamId: String(row.component_exam_id) }))) : [],
    reviewed_by: userId, reviewed_at: new Date().toISOString(), entry_origin: "manual",
  });
  if (error) redirect(`/conferencias/${conferenceId}?error=manual_save_failed`);
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=manual_saved`);
}

export async function completeManualProcedureTranscriptionAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");
  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences").select("id,extraction_result")
    .eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isParserResult(conference.extraction_result) || conference.extraction_result.status !== "reading_unavailable") {
    redirect(`/conferencias/${conferenceId}?error=manual_unavailable`);
  }
  const { data: updated } = await admin.from("conferences").update({ manual_transcription_completed_at: new Date().toISOString() })
    .eq("id", conferenceId).eq("created_by", userId).select("id").maybeSingle();
  if (!updated) redirect(`/conferencias/${conferenceId}?error=manual_save_failed`);
  const completionError = await syncProcedureReviewCompletion(conferenceId, userId);
  if (completionError) redirect(`/conferencias/${conferenceId}?error=manual_save_failed`);
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=manual_completed`);
}

export async function addMedicalRequestItemAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  const doctorName = formData.get("doctorName");
  const rawText = formData.get("rawText");
  const examId = formData.get("examId");
  if (!isUuid(conferenceId) || !isExamId(examId) || typeof doctorName !== "string" || !doctorName.trim() || typeof rawText !== "string" || !rawText.trim()) {
    redirect(`/conferencias/${typeof conferenceId === "string" ? conferenceId : ""}?error=medical_request_invalid`);
  }
  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences").select("id").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference) redirect("/conferencias?error=not_found");
  const { data: exam } = await admin.from("exams").select("id").eq("id", examId).eq("active", true).maybeSingle();
  if (!exam) redirect(`/conferencias/${conferenceId}?error=medical_request_invalid`);
  const { error: conferenceError } = await admin.from("conferences").update({ doctor_name: doctorName.trim(), doctor_is_manual: true }).eq("id", conferenceId).eq("created_by", userId);
  const { error: itemError } = await admin.from("conference_medical_request_items").upsert({ conference_id: conferenceId, exam_id: exam.id, raw_text: rawText.trim(), created_by: userId }, { onConflict: "conference_id,exam_id" });
  if (conferenceError || itemError) redirect(`/conferencias/${conferenceId}?error=medical_request_save_failed`);
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=medical_request_saved`);
}

function finalizationError(reason: string) {
  const errors: Record<string, string> = {
    pending_guide_review: "finalization_pending_review",
    medical_request_incomplete: "finalization_medical_request",
    not_authorized_request: "finalization_not_authorized",
    confirmation_required: "finalization_confirmation_required",
  };
  return errors[reason] ?? "finalization_failed";
}

function extractionMetadata(value: unknown) {
  if (!isParserResult(value) || !value.metadata) return {} as Record<string, string | null>;
  return value.metadata;
}

export async function finalizeConferenceAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");

  const admin = createSupabaseAdminClient();
  const [{ data: conference }, { data: reviews }, { data: requestItems }, { data: exams }] = await Promise.all([
    admin.from("conferences").select("id,status,doctor_name,extraction_result").eq("id", conferenceId).eq("created_by", userId).maybeSingle(),
    admin.from("conference_procedure_reviews").select("resolution,is_authorized,expanded_exam_ids").eq("conference_id", conferenceId),
    admin.from("conference_medical_request_items").select("id,exam_id,raw_text").eq("conference_id", conferenceId),
    admin.from("exams").select("id,name,mnemonic").eq("active", true),
  ]);
  if (!conference || conference.status === "finalized") redirect(`/conferencias/${conferenceId}?error=finalization_unavailable`);
  const examsById = new Map((exams ?? []).map((exam) => [String(exam.id), { examId: String(exam.id), name: exam.name, mnemonic: exam.mnemonic }]));
  const comparison = compareMedicalRequest((requestItems ?? []).map((item) => ({ examId: String(item.exam_id), rawText: item.raw_text })), (reviews ?? []).map((review) => ({ expandedExamIds: review.expanded_exam_ids?.map(String) ?? [], isAuthorized: review.is_authorized, resolution: review.resolution })));
  const request = comparison.flatMap((item) => {
    const exam = examsById.get(item.examId);
    return exam ? [{ ...exam, status: item.status }] : [];
  });
  const requestExamIds = new Set(request.map((item) => item.examId));
  const extraIds = [...new Set((reviews ?? []).flatMap((review) => review.is_authorized && review.resolution !== "needs_review" && review.resolution !== "excluded" ? review.expanded_exam_ids?.map(String) ?? [] : []))].filter((id) => !requestExamIds.has(id));
  const extras = extraIds.flatMap((id) => examsById.get(id) ? [examsById.get(id)!] : []);
  const selectedExtraExamIds = formData.getAll("selectedExtraExamIds").filter((value): value is string => typeof value === "string" && extraIds.includes(value));
  const finalization = prepareConferenceFinalization({
    confirmationAccepted: formData.get("confirmationAccepted") === "yes",
    doctorName: conference.doctor_name,
    hasPendingGuideReview: (reviews ?? []).some((review) => review.resolution === "needs_review"),
    requestItems: request,
    authorizedExtras: extras,
    selectedExtraExamIds,
  });
  if (finalization.status === "blocked") redirect(`/conferencias/${conferenceId}?error=${finalizationError(finalization.reason)}`);

  const metadata = extractionMetadata(conference.extraction_result);
  const divergences = request.filter((item) => item.status === "not_authorized").map(({ status: _status, ...item }) => item);
  const selectedExtras = extras.filter((item) => selectedExtraExamIds.includes(item.examId));
  const pdf = await createLacFormPdf({
    patientName: metadata.patient_name ?? null, doctorName: conference.doctor_name!,
    guideNumber: metadata.guide_number ?? null, password: metadata.password ?? null,
    passwordValidUntil: metadata.password_valid_until ?? null, authorizationDate: metadata.authorization_date ?? null,
    requestDate: metadata.request_date ?? null, released: finalization.released.filter((item) => item.origin === "medical_request"), authorizedExtras: selectedExtras, divergences,
  });
  const objectPath = `${conferenceId}/ficha-lac.pdf`;
  const { error: uploadError } = await admin.storage.from(LAC_FORMS_BUCKET).upload(objectPath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) redirect(`/conferencias/${conferenceId}?error=finalization_failed`);
  const snapshot = { metadata, released: finalization.released, authorizedExtras: selectedExtras, divergences };
  const { data: updated, error: updateError } = await admin.from("conferences").update({
    status: "finalized", finalized_at: new Date().toISOString(), finalized_by: userId, final_pdf_path: objectPath, final_snapshot: snapshot,
  }).eq("id", conferenceId).eq("created_by", userId).eq("status", conference.status).select("id").maybeSingle();
  if (updateError || !updated) {
    await admin.storage.from(LAC_FORMS_BUCKET).remove([objectPath]);
    redirect(`/conferencias/${conferenceId}?error=finalization_failed`);
  }
  revalidatePath("/conferencias");
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=finalized`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requestConferenceProcessing, startConferenceProcessing } from "./conference-upload";
import { createProcedureReviewStoreGateway } from "./procedure-review-gateway";
import { decideProcedureReview } from "./procedure-review-decision";
import { findProcedureApprovalIssues } from "./procedure-approval";
import { persistInitialProcedureReviews } from "./procedure-review-store";
import { prepareManualProcedure } from "./manual-procedure";
import { expandExplicitComposition, normalizeProcedureText } from "./procedure-review";
import { compareMedicalRequest } from "./medical-request-comparison";
import { prepareConferenceFinalization, resolveExtraApprovalSelection } from "./conference-finalization";
import { createLacFormPdf } from "./lac-form-pdf";
import { changedExamIds, createConferenceRevision } from "./conference-revision";

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

function isEditableConferenceStatus(status: string) {
  return status === "draft" || status === "processing";
}

async function syncProcedureReviewCompletion(conferenceId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { count, error: countError } = await admin.from("conference_procedure_reviews")
    .select("id", { count: "exact", head: true }).eq("conference_id", conferenceId).eq("resolution", "needs_review");
  if (countError) return countError.message;
  const { data, error } = await admin.from("conferences").update({
    procedure_review_completed_at: count === 0 ? new Date().toISOString() : null,
  }).eq("id", conferenceId).eq("created_by", userId).is("purged_at", null).in("status", ["draft", "processing"]).select("id").maybeSingle();
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

  const extractedDoctorName = parserResult.metadata?.doctor_name?.trim() || null;
  const { data: updated, error } = await admin.from("conferences").update({
    processing_requested_at: new Date().toISOString(),
    extraction_completed_at: new Date().toISOString(),
    extraction_result: parserResult,
    status: "processing",
    ...(extractedDoctorName ? { doctor_name: extractedDoctorName, doctor_is_manual: false } : {}),
  }).eq("id", conferenceId).eq("created_by", userId).is("purged_at", null).in("status", ["draft", "processing"]).select("id").maybeSingle();
  if (!updated && !error) return { status: "processing" as const, error: "A conferência não está mais disponível." };
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

export async function deleteConferenceAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");

  const admin = createSupabaseAdminClient();
  const { data: conference, error: loadError } = await admin.from("conferences")
    .select("id,status,source_file_path,final_pdf_path,purged_at")
    .eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (loadError || !conference || conference.purged_at || !["draft", "processing", "finalized"].includes(conference.status)) {
    redirect("/conferencias?error=not_found");
  }

  const runId = crypto.randomUUID();
  const { error: auditStartError } = await admin.from("conference_retention_audits").upsert({
    conference_id: conferenceId, run_id: runId, actor_user_id: userId,
    actor_type: "operator", status: "pending", reason: "user_requested",
  }, { onConflict: "conference_id" });
  if (auditStartError) redirect("/conferencias?error=delete_failed");

  try {
    const sourcePaths = conference.source_file_path ? [conference.source_file_path] : [];
    const finalPaths = conference.final_pdf_path ? [conference.final_pdf_path] : [];
    if (sourcePaths.length) {
      const { error } = await admin.storage.from(CONFERENCE_BUCKET).remove(sourcePaths);
      if (error) throw error;
    }
    if (finalPaths.length) {
      const { error } = await admin.storage.from(LAC_FORMS_BUCKET).remove(finalPaths);
      if (error) throw error;
    }

    const { error: procedureError } = await admin.from("conference_procedure_reviews").delete().eq("conference_id", conferenceId);
    if (procedureError) throw procedureError;
    const { error: requestError } = await admin.from("conference_medical_request_items").delete().eq("conference_id", conferenceId);
    if (requestError) throw requestError;
    const { error: revisionsError } = await admin.from("conference_revision_changes")
      .delete().or(`conference_id.eq.${conferenceId},parent_conference_id.eq.${conferenceId}`);
    if (revisionsError) throw revisionsError;
    const { error: childRevisionsError } = await admin.from("conferences")
      .update({ parent_conference_id: null }).eq("parent_conference_id", conferenceId);
    if (childRevisionsError) throw childRevisionsError;

    const { data: scrubbed, error: scrubError } = await admin.from("conferences").update({
      status: "purged", purged_at: new Date().toISOString(), purge_reason: "user_requested", purge_run_id: runId,
      source_file_path: null, source_file_uploaded_at: null, processing_requested_at: null,
      extraction_result: null, extraction_completed_at: null, doctor_name: null,
      final_pdf_path: null, finalized_at: null, finalized_by: null, final_snapshot: null,
      parent_conference_id: null,
    }).eq("id", conferenceId).eq("created_by", userId).is("purged_at", null)
      .in("status", ["draft", "processing", "finalized"]).select("id").maybeSingle();
    if (scrubError || !scrubbed) throw scrubError ?? new Error("Conference no longer available");

    const { error: auditError } = await admin.from("conference_retention_audits").update({ status: "completed" })
      .eq("conference_id", conferenceId).eq("run_id", runId).eq("reason", "user_requested");
    if (auditError) throw auditError;
  } catch {
    await admin.from("conference_retention_audits").update({ status: "failed" })
      .eq("conference_id", conferenceId).eq("run_id", runId).eq("reason", "user_requested");
    redirect("/conferencias?error=delete_failed");
  }

  revalidatePath("/conferencias");
  redirect("/conferencias?success=deleted");
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
    .select("id,status").eq("id", review.conference_id).eq("created_by", userId).maybeSingle();
  if (conferenceError || !conference || !isEditableConferenceStatus(conference.status)) redirect("/conferencias?error=not_found");

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

export async function approveConferenceProceduresAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");

  const admin = createSupabaseAdminClient();
  const { data: conference, error: conferenceError } = await admin.from("conferences")
    .select("id,status").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (conferenceError || !conference || !isEditableConferenceStatus(conference.status)) redirect("/conferencias?error=not_found");

  const { data: rows, error: reviewsError } = await admin.from("conference_procedure_reviews")
    .select("id,procedure_description,raw_text,source_page,procedure_code,requested_quantity,authorized_quantity,is_authorized,resolution,matched_exam_id,resolved_exam_id,entry_origin")
    .eq("conference_id", conference.id).order("source_index");
  if (reviewsError || !rows || rows.length === 0) redirect(`/conferencias/${conference.id}?error=review_approval_failed`);

  const issues = findProcedureApprovalIssues(rows.map((review) => ({
    id: String(review.id), rawText: review.raw_text, page: review.source_page, code: review.procedure_code,
    description: review.procedure_description, requestedQuantity: review.requested_quantity,
    authorizedQuantity: review.authorized_quantity, isAuthorized: review.is_authorized,
    resolution: review.resolution, matchedExamId: review.matched_exam_id === null ? null : String(review.matched_exam_id),
    resolvedExamId: review.resolved_exam_id === null ? null : String(review.resolved_exam_id), entryOrigin: review.entry_origin,
  })));
  if (issues.length > 0) redirect(`/conferencias/${conference.id}?error=review_approval_blocked`);

  const { error: updateError } = await admin.from("conference_procedure_reviews").update({
    resolution: "confirmed",
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq("conference_id", conference.id).eq("resolution", "auto_matched");
  if (updateError) redirect(`/conferencias/${conference.id}?error=review_approval_failed`);

  const completionError = await syncProcedureReviewCompletion(String(conference.id), userId);
  if (completionError) redirect(`/conferencias/${conference.id}?error=review_approval_failed`);

  revalidatePath(`/conferencias/${conference.id}`);
  redirect(`/conferencias/${conference.id}?success=review_approved`);
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
    .select("id,status,extraction_result").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isEditableConferenceStatus(conference.status) || !isParserResult(conference.extraction_result) || conference.extraction_result.status !== "reading_unavailable") {
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
  const { data: conference } = await admin.from("conferences").select("id,status,extraction_result")
    .eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isEditableConferenceStatus(conference.status) || !isParserResult(conference.extraction_result) || conference.extraction_result.status !== "reading_unavailable") {
    redirect(`/conferencias/${conferenceId}?error=manual_unavailable`);
  }
  const { data: updated } = await admin.from("conferences").update({ manual_transcription_completed_at: new Date().toISOString() })
    .eq("id", conferenceId).eq("created_by", userId).is("purged_at", null).in("status", ["draft", "processing"]).select("id").maybeSingle();
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
  const requestedExamIds = formData.getAll("examIds");
  const examIds = [...new Set(requestedExamIds.filter(isExamId))];
  if (!isUuid(conferenceId) || examIds.length === 0 || examIds.length !== requestedExamIds.length
    || (doctorName !== null && typeof doctorName !== "string") || (rawText !== null && typeof rawText !== "string")) {
    redirect(`/conferencias/${typeof conferenceId === "string" ? conferenceId : ""}?error=medical_request_invalid`);
  }
  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences").select("id,status").eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isEditableConferenceStatus(conference.status)) redirect("/conferencias?error=not_found");
  const { data: exams, error: examsError } = await admin.from("exams").select("id,name").in("id", examIds).eq("active", true);
  if (examsError || !exams || exams.length !== examIds.length) redirect(`/conferencias/${conferenceId}?error=medical_request_invalid`);
  const trimmedDoctorName = typeof doctorName === "string" ? doctorName.trim() : "";
  const { error: conferenceError } = trimmedDoctorName
    ? await admin.from("conferences").update({ doctor_name: trimmedDoctorName, doctor_is_manual: true }).eq("id", conferenceId).eq("created_by", userId).is("purged_at", null).in("status", ["draft", "processing"])
    : { error: null };
  const enteredRawText = typeof rawText === "string" ? rawText.trim() : "";
  const { error: itemError } = await admin.from("conference_medical_request_items").upsert(
    exams.map((exam) => ({ conference_id: conferenceId, exam_id: exam.id, raw_text: enteredRawText || exam.name, created_by: userId })),
    { onConflict: "conference_id,exam_id" },
  );
  if (conferenceError || itemError) redirect(`/conferencias/${conferenceId}?error=medical_request_save_failed`);
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=medical_request_saved`);
}

export async function removeMedicalRequestItemAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  const itemId = formData.get("itemId");
  if (!isUuid(conferenceId) || !isUuid(itemId)) {
    redirect(`/conferencias/${typeof conferenceId === "string" ? conferenceId : ""}?error=medical_request_invalid`);
  }

  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences").select("id,status")
    .eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!conference || !isEditableConferenceStatus(conference.status)) redirect("/conferencias?error=not_found");

  const { data: removed, error } = await admin.from("conference_medical_request_items")
    .delete().eq("id", itemId).eq("conference_id", conferenceId).select("id").maybeSingle();
  if (error || !removed) redirect(`/conferencias/${conferenceId}?error=medical_request_save_failed`);

  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=medical_request_removed`);
}

function finalizationError(reason: string) {
  const errors: Record<string, string> = {
    pending_guide_review: "finalization_pending_review",
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
    admin.from("conferences").select("id,status,doctor_name,extraction_result,parent_conference_id,revision_number").eq("id", conferenceId).eq("created_by", userId).maybeSingle(),
    admin.from("conference_procedure_reviews").select("resolution,is_authorized,expanded_exam_ids").eq("conference_id", conferenceId),
    admin.from("conference_medical_request_items").select("id,exam_id,raw_text").eq("conference_id", conferenceId),
    admin.from("exams").select("id,name,mnemonic").eq("active", true),
  ]);
  if (!conference || !isEditableConferenceStatus(conference.status)) redirect(`/conferencias/${conferenceId}?error=finalization_unavailable`);
  const examsById = new Map((exams ?? []).map((exam) => [String(exam.id), { examId: String(exam.id), name: exam.name, mnemonic: exam.mnemonic }]));
  const comparison = compareMedicalRequest((requestItems ?? []).map((item) => ({ examId: String(item.exam_id), rawText: item.raw_text })), (reviews ?? []).map((review) => ({ expandedExamIds: review.expanded_exam_ids?.map(String) ?? [], isAuthorized: review.is_authorized, resolution: review.resolution })));
  const request = comparison.flatMap((item) => {
    const exam = examsById.get(item.examId);
    return exam ? [{ ...exam, status: item.status }] : [];
  });
  const requestExamIds = new Set(request.map((item) => item.examId));
  const extraIds = [...new Set((reviews ?? []).flatMap((review) => review.is_authorized && review.resolution !== "needs_review" && review.resolution !== "excluded" ? review.expanded_exam_ids?.map(String) ?? [] : []))].filter((id) => !requestExamIds.has(id));
  const extras = extraIds.flatMap((id) => examsById.get(id) ? [examsById.get(id)!] : []);
  const selectedExtraExamIds = resolveExtraApprovalSelection({
    mode: formData.get("extrasApprovalMode"),
    submittedExamIds: formData.getAll("selectedExtraExamIds"),
    authorizedExtras: extras,
  });
  const finalization = prepareConferenceFinalization({
    confirmationAccepted: formData.get("confirmationAccepted") === "yes",
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
    patientName: metadata.patient_name ?? null, doctorName: conference.doctor_name ?? metadata.doctor_name ?? "Não informado",
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
  }).eq("id", conferenceId).eq("created_by", userId).eq("status", conference.status).is("purged_at", null).select("id").maybeSingle();
  if (updateError || !updated) {
    await admin.storage.from(LAC_FORMS_BUCKET).remove([objectPath]);
    redirect(`/conferencias/${conferenceId}?error=finalization_failed`);
  }
  if (conference.parent_conference_id) {
    const { data: parent } = await admin.from("conferences").select("final_snapshot").eq("id", conference.parent_conference_id).maybeSingle();
    const parentReleased = parent?.final_snapshot && typeof parent.final_snapshot === "object" && "released" in parent.final_snapshot && Array.isArray(parent.final_snapshot.released)
      ? (parent.final_snapshot.released as unknown[]).flatMap((item: unknown) => item && typeof item === "object" && "examId" in item && typeof item.examId === "string" ? [item.examId] : []) : [];
    const { error: auditError } = await admin.from("conference_revision_changes").insert({ conference_id: conferenceId, parent_conference_id: conference.parent_conference_id, changed_exam_ids: changedExamIds(parentReleased, finalization.released.map((item) => item.examId)).map(Number).filter(Number.isFinite), recorded_by: userId });
    if (auditError) {
      await admin.from("conferences").update({ status: "processing", finalized_at: null, finalized_by: null, final_pdf_path: null, final_snapshot: null }).eq("id", conferenceId);
      await admin.storage.from(LAC_FORMS_BUCKET).remove([objectPath]);
      redirect(`/conferencias/${conferenceId}?error=finalization_failed`);
    }
  }
  revalidatePath("/conferencias");
  revalidatePath(`/conferencias/${conferenceId}`);
  redirect(`/conferencias/${conferenceId}?success=finalized`);
}

export async function createConferenceRevisionAction(formData: FormData) {
  const userId = await currentOperatorId();
  const conferenceId = formData.get("conferenceId");
  if (!isUuid(conferenceId)) redirect("/conferencias?error=not_found");
  const admin = createSupabaseAdminClient();
  const { data: original } = await admin.from("conferences").select("id,status,revision_number")
    .eq("id", conferenceId).eq("created_by", userId).maybeSingle();
  if (!original || original.status !== "finalized") redirect(`/conferencias/${conferenceId}?error=revision_unavailable`);
  const revision = createConferenceRevision({ originalConferenceId: String(original.id), originalRevisionNumber: original.revision_number, actorUserId: userId });
  const { data: created, error } = await admin.from("conferences").insert({ created_by: revision.createdBy, parent_conference_id: revision.parentConferenceId, revision_number: revision.revisionNumber }).select("id").maybeSingle();
  if (error || !created) redirect(`/conferencias/${conferenceId}?error=revision_failed`);
  revalidatePath("/conferencias");
  redirect(`/conferencias/${created.id}?success=revision_created`);
}

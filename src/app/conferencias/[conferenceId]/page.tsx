import { notFound } from "next/navigation";

import { addManualProcedureAction, addMedicalRequestItemAction, completeManualProcedureTranscriptionAction, retryConferenceProcessingAction, reviewConferenceProcedureAction, uploadConferenceFileAction } from "@/features/conferences/conference-actions";
import { compareMedicalRequest } from "@/features/conferences/medical-request-comparison";
import { MedicalRequestView } from "@/features/conferences/medical-request-page";
import { ManualProcedureTranscriptionView } from "@/features/conferences/manual-procedure-page";
import { conferenceNotice } from "@/features/conferences/conference-notices";
import { ConferenceUploadPageView } from "@/features/conferences/conference-pages";
import { ConferenceProcedureReviewView } from "@/features/conferences/procedure-review-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConferenceUploadPage({ params, searchParams }: {
  params: Promise<{ conferenceId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ conferenceId }, query, supabase] = await Promise.all([params, searchParams, createSupabaseServerClient()]);
  const [{ data: conference, error }, { data: reviews, error: reviewsError }, { data: exams, error: examsError }, { data: requestItems, error: requestError }] = await Promise.all([
    supabase.from("conferences").select("id,status,created_at,source_file_path,procedure_review_completed_at,extraction_result,doctor_name").eq("id", conferenceId).maybeSingle(),
    supabase.from("conference_procedure_reviews").select("id,raw_text,source_page,procedure_code,procedure_description,requested_quantity,authorized_quantity,is_authorized,resolution,matched_exam_id,resolved_exam_id,expanded_exam_ids,entry_origin").eq("conference_id", conferenceId).order("source_index"),
    supabase.from("exams").select("id,name,mnemonic").eq("active", true).order("name"),
    supabase.from("conference_medical_request_items").select("id,exam_id,raw_text").eq("conference_id", conferenceId),
  ]);
  if (error) throw error;
  if (reviewsError) throw reviewsError;
  if (examsError) throw examsError;
  if (requestError) throw requestError;
  if (!conference || (conference.status !== "draft" && conference.status !== "processing")) notFound();
  const selectableExams = (exams ?? []).map((exam) => ({ id: String(exam.id), name: exam.name, mnemonic: exam.mnemonic }));
  const manualTranscription = conference.extraction_result && typeof conference.extraction_result === "object" && "status" in conference.extraction_result && conference.extraction_result.status === "reading_unavailable"
    ? <ManualProcedureTranscriptionView conferenceId={String(conference.id)} exams={selectableExams} saveAction={addManualProcedureAction} completeAction={completeManualProcedureTranscriptionAction} />
    : null;
  const comparisonBlocked = conference.procedure_review_completed_at === null;
  const comparison = compareMedicalRequest((requestItems ?? []).map((item) => ({ examId: String(item.exam_id), rawText: item.raw_text })), (reviews ?? []).map((review) => ({ expandedExamIds: review.expanded_exam_ids?.map(String) ?? [], isAuthorized: review.is_authorized, resolution: review.resolution })));
  const medicalRequest = <MedicalRequestView conferenceId={String(conference.id)} doctorName={conference.doctor_name} exams={selectableExams} saveAction={addMedicalRequestItemAction} comparisonBlocked={comparisonBlocked} items={(requestItems ?? []).map((item) => ({ id: String(item.id), rawText: item.raw_text, examId: String(item.exam_id), status: comparison.find((entry) => entry.examId === String(item.exam_id))?.status ?? "not_authorized" }))} />;
  return <ConferenceUploadPageView conference={{ id: String(conference.id), status: conference.status, createdAt: conference.created_at, hasSourceFile: Boolean(conference.source_file_path) }} uploadAction={uploadConferenceFileAction} retryProcessingAction={retryConferenceProcessingAction} notice={conferenceNotice(query)} procedureReview={
    <ConferenceProcedureReviewView
      reviews={(reviews ?? []).map((review) => ({
        id: String(review.id), rawText: review.raw_text, page: review.source_page, code: review.procedure_code,
        description: review.procedure_description, requestedQuantity: review.requested_quantity,
        authorizedQuantity: review.authorized_quantity, isAuthorized: review.is_authorized,
        resolution: review.resolution, matchedExamId: review.matched_exam_id === null ? null : String(review.matched_exam_id),
        resolvedExamId: review.resolved_exam_id === null ? null : String(review.resolved_exam_id), entryOrigin: review.entry_origin,
      }))}
      exams={selectableExams}
      reviewAction={reviewConferenceProcedureAction}
      blocked={comparisonBlocked}
    />
  } manualTranscription={manualTranscription} medicalRequest={medicalRequest} />;
}

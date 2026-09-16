import { notFound } from "next/navigation";

import { addManualProcedureAction, retryConferenceProcessingAction, reviewConferenceProcedureAction, uploadConferenceFileAction } from "@/features/conferences/conference-actions";
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
  const [{ data: conference, error }, { data: reviews, error: reviewsError }, { data: exams, error: examsError }] = await Promise.all([
    supabase.from("conferences").select("id,status,created_at,source_file_path,procedure_review_completed_at,extraction_result").eq("id", conferenceId).maybeSingle(),
    supabase.from("conference_procedure_reviews").select("id,raw_text,source_page,procedure_code,procedure_description,requested_quantity,authorized_quantity,is_authorized,resolution,matched_exam_id,resolved_exam_id,entry_origin").eq("conference_id", conferenceId).order("source_index"),
    supabase.from("exams").select("id,name,mnemonic").eq("active", true).order("name"),
  ]);
  if (error) throw error;
  if (reviewsError) throw reviewsError;
  if (examsError) throw examsError;
  if (!conference || (conference.status !== "draft" && conference.status !== "processing")) notFound();
  const manualTranscription = conference.extraction_result && typeof conference.extraction_result === "object" && "status" in conference.extraction_result && conference.extraction_result.status === "reading_unavailable"
    ? <ManualProcedureTranscriptionView conferenceId={String(conference.id)} exams={(exams ?? []).map((exam) => ({ id: String(exam.id), name: exam.name, mnemonic: exam.mnemonic }))} saveAction={addManualProcedureAction} />
    : null;
  return <ConferenceUploadPageView conference={{ id: String(conference.id), status: conference.status, createdAt: conference.created_at, hasSourceFile: Boolean(conference.source_file_path) }} uploadAction={uploadConferenceFileAction} retryProcessingAction={retryConferenceProcessingAction} notice={conferenceNotice(query)} procedureReview={
    <ConferenceProcedureReviewView
      reviews={(reviews ?? []).map((review) => ({
        id: String(review.id), rawText: review.raw_text, page: review.source_page, code: review.procedure_code,
        description: review.procedure_description, requestedQuantity: review.requested_quantity,
        authorizedQuantity: review.authorized_quantity, isAuthorized: review.is_authorized,
        resolution: review.resolution, matchedExamId: review.matched_exam_id === null ? null : String(review.matched_exam_id),
        resolvedExamId: review.resolved_exam_id === null ? null : String(review.resolved_exam_id), entryOrigin: review.entry_origin,
      }))}
      exams={(exams ?? []).map((exam) => ({ id: String(exam.id), name: exam.name, mnemonic: exam.mnemonic }))}
      reviewAction={reviewConferenceProcedureAction}
      blocked={conference.procedure_review_completed_at === null}
    />
  } manualTranscription={manualTranscription} />;
}

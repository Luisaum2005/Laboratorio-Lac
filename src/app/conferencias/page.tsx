import { createConferenceDraftAction, createConferenceRevisionAction, deleteConferenceAction } from "@/features/conferences/conference-actions";
import { conferenceNotice } from "@/features/conferences/conference-notices";
import { ConferenceListPageView, type ConferenceSummary } from "@/features/conferences/conference-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConferencesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; patient?: string }> }) {
  const [query, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("conferences").select("id,status,created_at,source_file_path,extraction_result,revision_number").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false });
  if (error) throw error;
  const patientSearch = query.patient?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const conferences: ConferenceSummary[] = (data ?? []).flatMap((conference) => {
    const patientName = conference.extraction_result && typeof conference.extraction_result === "object" && "metadata" in conference.extraction_result && conference.extraction_result.metadata && typeof conference.extraction_result.metadata === "object" && "patient_name" in conference.extraction_result.metadata && typeof conference.extraction_result.metadata.patient_name === "string" ? conference.extraction_result.metadata.patient_name : null;
    if (patientSearch && !patientName?.toLocaleLowerCase("pt-BR").includes(patientSearch)) return [];
    return (
    conference.status === "draft" || conference.status === "processing" || conference.status === "finalized"
      ? [{ id: String(conference.id), status: conference.status, createdAt: conference.created_at, hasSourceFile: Boolean(conference.source_file_path), hasExtractionResult: Boolean(conference.extraction_result && typeof conference.extraction_result === "object" && "status" in conference.extraction_result), patientName, revisionNumber: conference.revision_number }]
      : []
    );
  });
  return <ConferenceListPageView conferences={conferences} createDraftAction={createConferenceDraftAction} deleteAction={deleteConferenceAction} revisionAction={createConferenceRevisionAction} notice={conferenceNotice(query)} patientSearch={query.patient} />;
}

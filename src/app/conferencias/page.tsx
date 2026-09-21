import { createConferenceDraftAction } from "@/features/conferences/conference-actions";
import { conferenceNotice } from "@/features/conferences/conference-notices";
import { ConferenceListPageView, type ConferenceSummary } from "@/features/conferences/conference-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConferencesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [query, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const { data, error } = await supabase.from("conferences").select("id,status,created_at,source_file_path").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  const conferences: ConferenceSummary[] = (data ?? []).flatMap((conference) => (
    conference.status === "draft" || conference.status === "processing" || conference.status === "finalized"
      ? [{ id: String(conference.id), status: conference.status, createdAt: conference.created_at, hasSourceFile: Boolean(conference.source_file_path) }]
      : []
  ));
  return <ConferenceListPageView conferences={conferences} createDraftAction={createConferenceDraftAction} notice={conferenceNotice(query)} />;
}

import { notFound } from "next/navigation";

import { uploadConferenceFileAction } from "@/features/conferences/conference-actions";
import { conferenceNotice } from "@/features/conferences/conference-notices";
import { ConferenceUploadPageView } from "@/features/conferences/conference-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConferenceUploadPage({ params, searchParams }: {
  params: Promise<{ conferenceId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ conferenceId }, query, supabase] = await Promise.all([params, searchParams, createSupabaseServerClient()]);
  const { data: conference, error } = await supabase.from("conferences").select("id,status,created_at,source_file_path").eq("id", conferenceId).maybeSingle();
  if (error) throw error;
  if (!conference || (conference.status !== "draft" && conference.status !== "processing")) notFound();
  return <ConferenceUploadPageView conference={{ id: String(conference.id), status: conference.status, createdAt: conference.created_at, hasSourceFile: Boolean(conference.source_file_path) }} uploadAction={uploadConferenceFileAction} notice={conferenceNotice(query)} />;
}

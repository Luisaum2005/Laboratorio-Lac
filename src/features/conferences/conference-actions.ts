"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requestConferenceProcessing, startConferenceProcessing } from "./conference-upload";

const CONFERENCE_BUCKET = "unimed-guides";

async function currentOperatorId() {
  const requester = await createSupabaseServerClient();
  const { data } = await requester.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: profile } = await requester.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!profile) redirect("/login");
  return String(userId);
}

function isConferenceId(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function dispatchConferenceProcessing(
  conferenceId: string,
  userId: string,
  signedUrl: string,
) {
  const admin = createSupabaseAdminClient();
  const processorUrl = process.env.PDF_PROCESSOR_URL;
  const processorSecret = process.env.PDF_PROCESSOR_SHARED_SECRET;
  if (processorUrl) {
    if (!processorSecret) return { status: "awaiting_processing" as const, error: null };
    try {
      const response = await fetch(processorUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${processorSecret}`, "content-type": "application/json" },
        body: JSON.stringify({ conferenceId, sourceUrl: signedUrl }),
      });
      if (!response.ok) return { status: "awaiting_processing" as const, error: "O serviço de processamento não respondeu." };
    } catch {
      return { status: "awaiting_processing" as const, error: "O serviço de processamento está indisponível." };
    }
  } else {
    return { status: "awaiting_processing" as const, error: null };
  }

  const { error } = await admin.from("conferences").update({
    processing_requested_at: new Date().toISOString(), status: "processing",
  }).eq("id", conferenceId).eq("created_by", userId);
  return { status: "processing" as const, error: error?.message ?? null };
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
  if (!isConferenceId(conferenceId)) redirect("/conferencias?error=not_found");

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
  if (!isConferenceId(conferenceId)) redirect("/conferencias?error=not_found");

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

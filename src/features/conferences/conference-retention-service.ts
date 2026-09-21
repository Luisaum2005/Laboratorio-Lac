import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { runRetention, type RetentionGateway } from "./conference-retention";

const BUCKETS = ["unimed-guides", "lac-forms"] as const;

async function removeOrphanedFilesBefore(cutoff: string) {
  const admin = createSupabaseAdminClient();
  for (const bucket of BUCKETS) {
    const directExpiredPaths: string[] = [];
    for (let folderOffset = 0; ; folderOffset += 1000) {
      const { data: folders, error } = await admin.storage.from(bucket).list("", { limit: 1000, offset: folderOffset });
      if (error) throw error;
      for (const folder of folders ?? []) {
        if (folder.id) {
          if (folder.created_at && folder.created_at < cutoff) directExpiredPaths.push(folder.name);
          continue;
        }
        const expiredPaths: string[] = [];
        for (let fileOffset = 0; ; fileOffset += 1000) {
          const { data: files, error: filesError } = await admin.storage.from(bucket).list(folder.name, { limit: 1000, offset: fileOffset });
          if (filesError) throw filesError;
          expiredPaths.push(...(files ?? []).flatMap((file) => !file.created_at || file.created_at >= cutoff ? [] : [`${folder.name}/${file.name}`]));
          if ((files ?? []).length < 1000) break;
        }
        if (expiredPaths.length) {
          const { error: removeError } = await admin.storage.from(bucket).remove(expiredPaths);
          if (removeError) throw removeError;
        }
      }
      if ((folders ?? []).length < 1000) break;
    }
    if (directExpiredPaths.length) {
      const { error } = await admin.storage.from(bucket).remove(directExpiredPaths);
      if (error) throw error;
    }
  }
}

function createRetentionGateway(actorUserId: string | null): RetentionGateway {
  const admin = createSupabaseAdminClient();
  return {
    findExpired: async (cutoff) => {
      const candidates: Array<{ id: string; source_file_path: string | null; final_pdf_path: string | null; purged_at: string | null }> = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await admin.from("conferences").select("id,source_file_path,final_pdf_path,purged_at")
          .lt("created_at", cutoff).range(offset, offset + 999);
        if (error) throw error;
        candidates.push(...(data ?? []));
        if ((data ?? []).length < 1000) break;
      }
      const completedIds = new Set<string>();
      for (let start = 0; start < candidates.length; start += 1000) {
        const ids = candidates.slice(start, start + 1000).map((conference) => conference.id);
        const { data: audits, error: auditsError } = await admin.from("conference_retention_audits").select("conference_id,status").in("conference_id", ids);
        if (auditsError) throw auditsError;
        for (const audit of audits ?? []) if (audit.status === "completed") completedIds.add(String(audit.conference_id));
      }
      return candidates.flatMap((conference) => {
        if (conference.purged_at && completedIds.has(String(conference.id))) return [];
        return [{ id: String(conference.id), sourceFilePath: conference.source_file_path, finalPdfPath: conference.final_pdf_path, alreadyPurged: Boolean(conference.purged_at) }];
      });
    },
    removeFiles: async (bucket, paths) => {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw error;
    },
    removeOrphanedFiles: removeOrphanedFilesBefore,
    scrubConference: async (conferenceId, runId, purgedAt) => {
      const { error: proceduresError } = await admin.from("conference_procedure_reviews").delete().eq("conference_id", conferenceId);
      if (proceduresError) throw proceduresError;
      const { error: requestsError } = await admin.from("conference_medical_request_items").delete().eq("conference_id", conferenceId);
      if (requestsError) throw requestsError;
      const { error: revisionsError } = await admin.from("conference_revision_changes").delete().or(`conference_id.eq.${conferenceId},parent_conference_id.eq.${conferenceId}`);
      if (revisionsError) throw revisionsError;
      const { data, error } = await admin.from("conferences").update({
        status: "purged", purged_at: purgedAt, purge_reason: "retention_expired", purge_run_id: runId,
        source_file_path: null, source_file_uploaded_at: null, processing_requested_at: null,
        extraction_result: null, extraction_completed_at: null, doctor_name: null,
        final_pdf_path: null, finalized_at: null, finalized_by: null, final_snapshot: null,
        parent_conference_id: null,
      }).eq("id", conferenceId).is("purged_at", null).select("id").maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    beginAudit: async (entry) => {
      const { error } = await admin.from("conference_retention_audits").upsert({
        conference_id: entry.conferenceId, run_id: entry.runId, actor_user_id: actorUserId,
        actor_type: actorUserId ? "administrator" : "system", status: "pending", reason: entry.reason,
      }, { onConflict: "conference_id" });
      if (error) throw error;
    },
    finishAudit: async (entry) => {
      const { error } = await admin.from("conference_retention_audits").update({
        run_id: entry.runId, actor_user_id: actorUserId, actor_type: actorUserId ? "administrator" : "system", status: entry.status,
      }).eq("conference_id", entry.conferenceId).eq("reason", entry.reason);
      if (error) throw error;
    },
  };
}

export function runScheduledRetention() {
  return runRetention(createRetentionGateway(null));
}

export function runAdministrativeRetention(actorUserId: string) {
  return runRetention(createRetentionGateway(actorUserId));
}

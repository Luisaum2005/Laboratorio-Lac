const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SOURCE_BUCKET = "unimed-guides";
const FINAL_FORM_BUCKET = "lac-forms";

export type RetentionGateway = {
  findExpired: (cutoff: string) => Promise<Array<{ id: string; sourceFilePath: string | null; finalPdfPath: string | null; alreadyPurged: boolean }>>;
  removeFiles: (bucket: string, paths: string[]) => Promise<void>;
  removeOrphanedFiles: (cutoff: string) => Promise<void>;
  scrubConference: (conferenceId: string, runId: string, purgedAt: string) => Promise<boolean>;
  beginAudit: (entry: { conferenceId: string; runId: string; reason: "retention_expired" }) => Promise<void>;
  finishAudit: (entry: { conferenceId: string; runId: string; status: "completed" | "failed"; reason: "retention_expired" }) => Promise<void>;
};

export function selectExpiredConferences(records: Array<{ id: string; createdAt: string; purgedAt: string | null }>, now: Date) {
  const cutoff = now.getTime() - RETENTION_MS;
  return records.filter((record) => !record.purgedAt && new Date(record.createdAt).getTime() < cutoff).map((record) => record.id);
}

export async function runRetention(gateway: RetentionGateway, now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_MS).toISOString();
  const purgedAt = now.toISOString();
  const runId = crypto.randomUUID();
  const conferences = await gateway.findExpired(cutoff);
  let completed = 0;
  let failed = 0;

  for (const conference of conferences) {
    try {
      await gateway.beginAudit({ conferenceId: conference.id, runId, reason: "retention_expired" });
      if (!conference.alreadyPurged) {
        if (conference.sourceFilePath) await gateway.removeFiles(SOURCE_BUCKET, [conference.sourceFilePath]);
        if (conference.finalPdfPath) await gateway.removeFiles(FINAL_FORM_BUCKET, [conference.finalPdfPath]);
        if (!await gateway.scrubConference(conference.id, runId, purgedAt)) continue;
      }
      await gateway.finishAudit({ conferenceId: conference.id, runId, status: "completed", reason: "retention_expired" });
      completed += 1;
    } catch {
      failed += 1;
      try {
        await gateway.finishAudit({ conferenceId: conference.id, runId, status: "failed", reason: "retention_expired" });
      } catch {
        // The pending audit is intentionally retained for the next idempotent run.
      }
    }
  }
  await gateway.removeOrphanedFiles(cutoff);
  return { runId, completed, failed };
}

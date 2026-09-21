import { describe, expect, it } from "vitest";

import { runRetention, selectExpiredConferences, type RetentionGateway } from "./conference-retention";

describe("retenção de conferências", () => {
  it("seleciona somente conferências vencidas e ainda não eliminadas", () => {
    expect(selectExpiredConferences([
      { id: "old", createdAt: "2026-08-01T00:00:00Z", purgedAt: null },
      { id: "new", createdAt: "2026-09-20T00:00:00Z", purgedAt: null },
      { id: "done", createdAt: "2026-08-01T00:00:00Z", purgedAt: "2026-09-01T00:00:00Z" },
    ], new Date("2026-09-21T00:00:00Z"))).toEqual(["old"]);
  });

  it("remove dados e arquivos uma vez, mantendo auditoria agregada", async () => {
    const calls: string[] = [];
    const gateway: RetentionGateway = {
      findExpired: async () => [{ id: "old", sourceFilePath: "old/source.pdf", finalPdfPath: "old/final.pdf", alreadyPurged: false }],
      removeFiles: async (bucket, paths) => { calls.push(`files:${bucket}:${paths.join(",")}`); },
      scrubConference: async (id) => { calls.push(`scrub:${id}`); return true; },
      beginAudit: async (entry) => { calls.push(`pending:${entry.conferenceId}`); },
      finishAudit: async (entry) => { calls.push(`audit:${entry.conferenceId}:${entry.status}:${entry.reason}`); },
      removeOrphanedFiles: async () => { calls.push("orphans"); },
    };

    await runRetention(gateway, new Date("2026-09-21T00:00:00Z"));
    await runRetention({ ...gateway, findExpired: async () => [] }, new Date("2026-09-21T00:00:00Z"));

    expect(calls).toContain("files:unimed-guides:old/source.pdf");
    expect(calls).toContain("files:lac-forms:old/final.pdf");
    expect(calls).toContain("scrub:old");
    expect(calls).toContain("audit:old:completed:retention_expired");
    expect(calls.filter((call) => call === "audit:old:completed:retention_expired")).toHaveLength(1);
  });

  it("retoma uma conferência já expurgada cujo registro de auditoria ficou pendente", async () => {
    const calls: string[] = [];
    const gateway: RetentionGateway = {
      findExpired: async () => [{ id: "purged", sourceFilePath: null, finalPdfPath: null, alreadyPurged: true }],
      removeFiles: async () => { throw new Error("não deve remover novamente"); },
      scrubConference: async () => { throw new Error("não deve expurgar novamente"); },
      beginAudit: async () => { calls.push("pending"); },
      finishAudit: async (entry) => { calls.push(entry.status); },
      removeOrphanedFiles: async () => undefined,
    };
    await runRetention(gateway);
    expect(calls).toEqual(["pending", "completed"]);
  });
});

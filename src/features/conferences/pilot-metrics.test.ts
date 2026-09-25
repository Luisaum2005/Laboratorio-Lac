import { describe, expect, it } from "vitest";

import { summarizePilotMetrics } from "./pilot-metrics";

describe("indicadores agregados do piloto", () => {
  it("resume volume, leitura, correções e tempo sem expor dados clínicos", () => {
    expect(summarizePilotMetrics([
      { status: "finalized", createdAt: "2026-09-23T08:00:00Z", finalizedAt: "2026-09-23T10:00:00Z", extractionResult: { status: "ok" }, doctorIsManual: false },
      { status: "finalized", createdAt: "2026-09-23T08:00:00Z", finalizedAt: "2026-09-23T14:00:00Z", extractionResult: { status: "ok" }, doctorIsManual: true },
      { status: "processing", createdAt: "2026-09-23T08:00:00Z", finalizedAt: null, extractionResult: null, doctorIsManual: true },
      { status: "purged", createdAt: "2026-09-23T08:00:00Z", finalizedAt: null, extractionResult: null, doctorIsManual: false },
    ])).toEqual({
      total: 3,
      finalized: 2,
      inProgress: 1,
      guideRead: 2,
      manualDoctorCorrections: 2,
      completionRatePercent: 67,
      medianFinalizationHours: 4,
    });
  });

  it("retorna métricas neutras quando o piloto ainda não tem conferências", () => {
    expect(summarizePilotMetrics([])).toEqual({
      total: 0,
      finalized: 0,
      inProgress: 0,
      guideRead: 0,
      manualDoctorCorrections: 0,
      completionRatePercent: 0,
      medianFinalizationHours: null,
    });
  });
});

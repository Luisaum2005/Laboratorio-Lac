export type PilotConferenceRecord = {
  status: "draft" | "processing" | "finalized" | "purged";
  createdAt: string;
  finalizedAt: string | null;
  extractionResult: unknown;
  doctorIsManual: boolean;
};

export type PilotMetrics = {
  total: number;
  finalized: number;
  inProgress: number;
  guideRead: number;
  manualDoctorCorrections: number;
  completionRatePercent: number;
  medianFinalizationHours: number | null;
};

function hasExtractionResult(value: unknown) {
  return Boolean(value && typeof value === "object" && "status" in value);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
  return Math.round(value * 10) / 10;
}

export function summarizePilotMetrics(records: PilotConferenceRecord[]): PilotMetrics {
  const operationalRecords = records.filter((record) => record.status !== "purged");
  const finalized = operationalRecords.filter((record) => record.status === "finalized");
  const durations = finalized.flatMap((record) => {
    const created = Date.parse(record.createdAt);
    const completed = record.finalizedAt ? Date.parse(record.finalizedAt) : NaN;
    return Number.isFinite(created) && Number.isFinite(completed) && completed >= created
      ? [(completed - created) / (60 * 60 * 1000)]
      : [];
  });

  return {
    total: operationalRecords.length,
    finalized: finalized.length,
    inProgress: operationalRecords.length - finalized.length,
    guideRead: operationalRecords.filter((record) => hasExtractionResult(record.extractionResult)).length,
    manualDoctorCorrections: operationalRecords.filter((record) => record.doctorIsManual).length,
    completionRatePercent: operationalRecords.length === 0 ? 0 : Math.round((finalized.length / operationalRecords.length) * 100),
    medianFinalizationHours: median(durations),
  };
}

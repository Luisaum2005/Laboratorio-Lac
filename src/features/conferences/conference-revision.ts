export function createConferenceRevision(input: { originalConferenceId: string; originalRevisionNumber: number; actorUserId: string }) {
  return { parentConferenceId: input.originalConferenceId, revisionNumber: input.originalRevisionNumber + 1, createdBy: input.actorUserId, status: "draft" as const };
}

export function changedExamIds(before: string[], after: string[]) {
  const prior = new Set(before);
  const current = new Set(after);
  return [...new Set([...before, ...after])].filter((examId) => prior.has(examId) !== current.has(examId));
}

export function canDeleteConference(conference: { purgedAt: string | null; status?: string } | null) {
  return Boolean(conference && !conference.purgedAt);
}

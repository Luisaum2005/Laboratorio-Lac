import { describe, expect, it } from "vitest";

import { canDeleteConference } from "./conference-deletion";

describe("exclusão de conferências", () => {
  it("permite excluir conferências sem depender do estado operacional", () => {
    for (const status of ["draft", "processing", "finalized", "future_status"]) {
      expect(canDeleteConference({ status, purgedAt: null })).toBe(true);
    }
  });

  it("não permite repetir a exclusão de uma conferência já expurgada", () => {
    expect(canDeleteConference({ status: "purged", purgedAt: "2026-09-25T10:00:00Z" })).toBe(false);
    expect(canDeleteConference(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { changedExamIds, createConferenceRevision } from "./conference-revision";

describe("revisões imutáveis de conferência", () => {
  it("cria uma revisão vinculada sem substituir a versão final", () => {
    expect(createConferenceRevision({ originalConferenceId: "original-1", originalRevisionNumber: 2, actorUserId: "user-1" })).toEqual({
      parentConferenceId: "original-1", revisionNumber: 3, createdBy: "user-1", status: "draft",
    });
  });

  it("registra quais exames mudaram entre a ficha original e a nova revisão", () => {
    expect(changedExamIds(["10", "11"], ["11", "12"])).toEqual(["10", "12"]);
  });
});

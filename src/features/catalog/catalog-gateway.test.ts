import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createCatalogGovernanceGateway } from "./catalog-gateway";
import { deactivateCanonicalExam, updateCanonicalExam, revokeAlias, removeComposition, type CatalogGovernanceGateway } from "./catalog-governance";

describe("resultado de mutações no catálogo", () => {
  it.each([
    ["edição", (gateway: CatalogGovernanceGateway) => updateCanonicalExam({ id: "42", name: "Hemograma", mnemonic: "HM" }, gateway)],
    ["desativação", (gateway: CatalogGovernanceGateway) => deactivateCanonicalExam("42", gateway)],
    ["revogação de alias", (gateway: CatalogGovernanceGateway) => revokeAlias("9", gateway)],
    ["remoção de componente", (gateway: CatalogGovernanceGateway) => removeComposition({ packageExamId: "42", componentExamId: "7" }, gateway)],
  ] as const)("confirma %s quando o banco alterou um registro", async (name, mutate) => {
    const supabase = createClient("https://catalog.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `success-${name}` },
      global: { fetch: async () => new Response('[{"id":42}]', { status: 200, headers: { "Content-Type": "application/json" } }) },
    });
    expect((await mutate(createCatalogGovernanceGateway(supabase))).status).toBe("success");
  });
  it.each([
    ["edição", (gateway: CatalogGovernanceGateway) => updateCanonicalExam({ id: "42", name: "Hemograma", mnemonic: "HM" }, gateway)],
    ["revogação de alias", (gateway: CatalogGovernanceGateway) => revokeAlias("9", gateway)],
    ["remoção de componente", (gateway: CatalogGovernanceGateway) => removeComposition({ packageExamId: "42", componentExamId: "7" }, gateway)],
  ] as const)("não confirma %s sem registro correspondente", async (name, mutate) => {
    const supabase = createClient("https://catalog.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `missing-${name}` },
      global: { fetch: async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }) },
    });
    expect((await mutate(createCatalogGovernanceGateway(supabase))).status).toBe("error");
  });
  it("não confirma desativação quando o banco não alterou nenhum registro", async () => {
    const supabase = createClient("https://catalog.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "missing-deactivate" },
      global: { fetch: async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }) },
    });
    const result = await deactivateCanonicalExam("42", createCatalogGovernanceGateway(supabase));
    expect(result.status).toBe("error");
  });
});

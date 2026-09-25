import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogGovernanceGateway } from "./catalog-governance";

function affectedRecordResult(data: unknown[] | null, error: { message: string } | null) {
  return { error: error?.message ?? (data?.length === 1 ? null : "Registro não encontrado ou alterado.") };
}

export function createCatalogGovernanceGateway(supabase: SupabaseClient): CatalogGovernanceGateway {
  return {
    insertExam: async (input) => {
      const { error } = await supabase.from("exams").insert(input);
      return { error: error?.message ?? null };
    },
    updateExam: async (id, input) => {
      const { data, error } = await supabase.from("exams").update(input).eq("id", id).select("id");
      return affectedRecordResult(data, error);
    },
    deactivateExam: async (id) => {
      const { data, error } = await supabase.from("exams").update({ active: false }).eq("id", id).select("id");
      return affectedRecordResult(data, error);
    },
    insertAlias: async (examId, input) => {
      const { error } = await supabase.from("exam_aliases").insert({
        exam_id: examId,
        alias: input.alias,
        normalized_alias: input.normalizedAlias,
      });
      return { error: error?.message ?? null };
    },
    deleteAlias: async (aliasId) => {
      const { data, error } = await supabase.from("exam_aliases").delete().eq("id", aliasId).select("id");
      return affectedRecordResult(data, error);
    },
    insertTussCode: async (examId, code) => {
      const { error } = await supabase.from("exam_tuss_codes").insert({
        exam_id: examId,
        tuss_code: code,
      });
      return { error: error?.message ?? null };
    },
    deleteTussCode: async (code) => {
      const { data, error } = await supabase.from("exam_tuss_codes").delete()
        .eq("tuss_code", code).select("tuss_code");
      return affectedRecordResult(data, error);
    },
    insertComposition: async (input) => {
      const { error } = await supabase.from("exam_compositions").insert({
        package_exam_id: input.packageExamId,
        component_exam_id: input.componentExamId,
      });
      return { error: error?.message ?? null };
    },
    deleteComposition: async (input) => {
      const { data, error } = await supabase.from("exam_compositions").delete()
        .eq("package_exam_id", input.packageExamId)
        .eq("component_exam_id", input.componentExamId).select("package_exam_id");
      return affectedRecordResult(data, error);
    },
  };
}

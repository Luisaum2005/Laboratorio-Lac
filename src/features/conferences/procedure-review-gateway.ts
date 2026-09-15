import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProcedureReviewStoreGateway } from "./procedure-review-store";

export function createProcedureReviewStoreGateway(supabase: SupabaseClient): ProcedureReviewStoreGateway {
  return {
    countReviews: async (conferenceId) => {
      const { count, error } = await supabase.from("conference_procedure_reviews")
        .select("id", { count: "exact", head: true }).eq("conference_id", conferenceId);
      return { count: count ?? 0, error: error?.message ?? null };
    },
    listAliases: async () => {
      const [{ data: exams, error: examsError }, { data: aliases, error: aliasesError }] = await Promise.all([
        supabase.from("exams").select("id").eq("active", true),
        supabase.from("exam_aliases").select("exam_id,normalized_alias"),
      ]);
      if (examsError || aliasesError) return { aliases: [], error: examsError?.message ?? aliasesError?.message ?? "Erro desconhecido." };
      const activeExamIds = new Set((exams ?? []).map((exam) => String(exam.id)));
      return {
        aliases: (aliases ?? []).flatMap((alias) => activeExamIds.has(String(alias.exam_id)) ? [{
          examId: String(alias.exam_id),
          normalizedAlias: String(alias.normalized_alias),
        }] : []),
        error: null,
      };
    },
    listCompositions: async () => {
      const { data, error } = await supabase.from("exam_compositions").select("package_exam_id,component_exam_id");
      return {
        compositions: (data ?? []).map((composition) => ({
          packageExamId: String(composition.package_exam_id),
          componentExamId: String(composition.component_exam_id),
        })),
        error: error?.message ?? null,
      };
    },
    saveInitialReviews: async (conferenceId, reviews) => {
      const { error } = await supabase.from("conference_procedure_reviews").insert(reviews.map((review) => ({
        conference_id: conferenceId,
        source_index: review.sourceIndex,
        raw_text: review.rawText,
        normalized_text: review.normalizedText,
        source_page: review.page,
        procedure_code: review.code,
        procedure_description: review.description,
        requested_quantity: review.requestedQuantity,
        authorized_quantity: review.authorizedQuantity,
        is_authorized: review.isAuthorized,
        resolution: review.resolution,
        matched_exam_id: review.matchedExamId,
        resolved_exam_id: review.resolvedExamId,
        expanded_exam_ids: review.expandedExamIds,
      })));
      return { error: error?.message ?? null };
    },
  };
}

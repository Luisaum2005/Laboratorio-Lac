import { notFound, redirect } from "next/navigation";

import {
  addCompositionAction,
  addTussCodeAction,
  approveAliasAction,
  deactivateExamAction,
  removeCompositionAction,
  revokeAliasAction,
  revokeTussCodeAction,
  updateExamAction,
} from "@/features/catalog/catalog-actions";
import { ExamGovernancePageView } from "@/features/catalog/exam-governance-page";
import { catalogNotice } from "@/features/catalog/catalog-notices";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ExamGovernancePage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { examId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const appMetadata = claimsData?.claims.app_metadata as { role?: string } | undefined;
  if (!claimsData?.claims.sub) redirect("/login");
  const viewerRole = appMetadata?.role === "admin" ? "admin" : "operator";

  const [examResult, aliasesResult, tussCodesResult, compositionsResult, examsResult] = await Promise.all([
    supabase.from("exams").select("id,name,mnemonic,active").eq("id", examId).maybeSingle(),
    supabase.from("exam_aliases").select("id,alias").eq("exam_id", examId).order("alias"),
    supabase.from("exam_tuss_codes").select("tuss_code").eq("exam_id", examId).order("tuss_code"),
    supabase.from("exam_compositions").select("component_exam_id").eq("package_exam_id", examId),
    supabase.from("exams").select("id,name,mnemonic,active").order("name"),
  ]);

  const error = examResult.error ?? aliasesResult.error ?? tussCodesResult.error ?? compositionsResult.error ?? examsResult.error;
  if (error) throw error;
  if (!examResult.data) notFound();
  const selectedExam = examResult.data;

  const allExams = (examsResult.data ?? []).map((exam) => ({
    id: String(exam.id),
    name: exam.name,
    mnemonic: exam.mnemonic,
    active: exam.active,
  }));
  const componentIds = new Set(
    (compositionsResult.data ?? []).map((composition) => String(composition.component_exam_id)),
  );

  return (
    <ExamGovernancePageView
      viewerRole={viewerRole}
      exam={{ ...selectedExam, id: String(selectedExam.id) }}
      aliases={(aliasesResult.data ?? []).map((item) => ({
        id: String(item.id),
        alias: item.alias,
      }))}
      tussCodes={(tussCodesResult.data ?? []).map((item) => String(item.tuss_code))}
      components={allExams.filter((exam) => componentIds.has(exam.id))}
      availableComponents={allExams.filter(
        (exam) => exam.active && exam.id !== String(selectedExam.id) && !componentIds.has(exam.id),
      )}
      updateExamAction={updateExamAction}
      deactivateExamAction={deactivateExamAction}
      approveAliasAction={approveAliasAction}
      revokeAliasAction={revokeAliasAction}
      addTussCodeAction={addTussCodeAction}
      revokeTussCodeAction={revokeTussCodeAction}
      addCompositionAction={addCompositionAction}
      removeCompositionAction={removeCompositionAction}
      notice={catalogNotice(query)}
    />
  );
}

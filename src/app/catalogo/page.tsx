import { CatalogPageView, type CatalogExam } from "@/features/catalog/catalog-page";
import { createExamAction, importMnemonicSpreadsheetAction } from "@/features/catalog/catalog-actions";
import { catalogNotice } from "@/features/catalog/catalog-notices";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; added?: string; updated?: string; unchanged?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: claimsData }, { data, error }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("exams").select("id,name,mnemonic").eq("active", true).order("name"),
  ]);

  if (error) throw error;

  const appMetadata = claimsData?.claims.app_metadata as { role?: string } | undefined;
  const viewerRole = appMetadata?.role === "admin" ? "admin" : "operator";
  const exams: CatalogExam[] = (data ?? []).map((exam) => ({
    id: String(exam.id),
    name: exam.name,
    mnemonic: exam.mnemonic,
  }));

  return (
    <CatalogPageView
      viewerRole={viewerRole}
      exams={exams}
      createExamAction={createExamAction}
      importMnemonicSpreadsheetAction={importMnemonicSpreadsheetAction}
      notice={catalogNotice(query)}
    />
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  addComposition,
  addTussCode,
  approveAlias,
  createCanonicalExam,
  deactivateCanonicalExam,
  removeComposition,
  revokeTussCode,
  revokeAlias,
  type CatalogMutationResult,
  updateCanonicalExam,
} from "./catalog-governance";
import { createCatalogGovernanceGateway } from "./catalog-gateway";
import { readCanonicalExamsFromBytes, SpreadsheetCatalogError } from "./spreadsheet-catalog";

const MAX_CATALOG_SPREADSHEET_BYTES = 800_000;

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

async function adminContext() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const appMetadata = data?.claims.app_metadata as { role?: string } | undefined;
  return appMetadata?.role === "admin" ? { gateway: createCatalogGovernanceGateway(supabase), supabase } : null;
}

function finishMutation(result: CatalogMutationResult, destination: string, success: string): never {
  if (result.status === "success") {
    revalidatePath("/catalogo");
    redirect(`${destination}?success=${success}`);
  }
  redirect(`${destination}?error=${result.status}`);
}

export async function createExamAction(formData: FormData) {
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await createCanonicalExam(
    { name: value(formData, "name"), mnemonic: value(formData, "mnemonic") },
    context.gateway,
  );
  finishMutation(result, "/catalogo", "exam-created");
}

export async function importMnemonicSpreadsheetAction(formData: FormData) {
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  if (formData.get("confirmMnemonicImport") !== "yes") {
    redirect("/catalogo?error=mnemonic-import-confirmation-required");
  }

  const file = formData.get("mnemonicSpreadsheet");
  if (!(file instanceof File) || file.size === 0 || !/\.(xls|xml)$/i.test(file.name)) {
    redirect("/catalogo?error=mnemonic-import-file-required");
  }
  if (file.size > MAX_CATALOG_SPREADSHEET_BYTES) {
    redirect("/catalogo?error=mnemonic-import-too-large");
  }

  let importedExams;
  try {
    importedExams = readCanonicalExamsFromBytes(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    const reason = error instanceof SpreadsheetCatalogError ? error.reason : "invalid_format";
    const errorCode = reason === "invalid_row" ? "mnemonic-import-invalid-row" : reason === "duplicate_mnemonic" ? "mnemonic-import-duplicate" : "mnemonic-import-invalid-format";
    redirect(`/catalogo?error=${errorCode}`);
  }

  const { data: existingExams, error: lookupError } = await context.supabase
    .from("exams")
    .select("mnemonic,name")
    .limit(10_000);
  if (lookupError) redirect("/catalogo?error=mnemonic-import-failed");

  const existingByMnemonic = new Map((existingExams ?? []).map((exam) => [exam.mnemonic, exam.name]));
  const added = importedExams.filter((exam) => !existingByMnemonic.has(exam.mnemonic)).length;
  const updated = importedExams.filter((exam) => existingByMnemonic.has(exam.mnemonic) && existingByMnemonic.get(exam.mnemonic) !== exam.name).length;
  const unchanged = importedExams.length - added - updated;
  const examsToSave = importedExams.filter((exam) => existingByMnemonic.get(exam.mnemonic) !== exam.name);

  if (examsToSave.length > 0) {
    const { error } = await context.supabase.from("exams").upsert(examsToSave, { onConflict: "mnemonic" });
    if (error) redirect("/catalogo?error=mnemonic-import-failed");
  }

  revalidatePath("/catalogo");
  revalidatePath("/catalogo/[examId]", "page");
  revalidatePath("/conferencias");
  revalidatePath("/conferencias/[conferenceId]", "page");
  redirect(`/catalogo?success=mnemonics-imported&added=${added}&updated=${updated}&unchanged=${unchanged}`);
}

export async function updateExamAction(formData: FormData) {
  const examId = value(formData, "examId");
  const destination = `/catalogo/${encodeURIComponent(examId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await updateCanonicalExam(
    { id: examId, name: value(formData, "name"), mnemonic: value(formData, "mnemonic") },
    context.gateway,
  );
  finishMutation(result, destination, "exam-updated");
}

export async function deactivateExamAction(formData: FormData) {
  const examId = value(formData, "examId");
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await deactivateCanonicalExam(examId, context.gateway);
  finishMutation(result, "/catalogo", "exam-deactivated");
}

export async function approveAliasAction(formData: FormData) {
  const examId = value(formData, "examId");
  const destination = `/catalogo/${encodeURIComponent(examId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await approveAlias(
    { examId, alias: value(formData, "alias") },
    context.gateway,
  );
  finishMutation(result, destination, "alias-approved");
}

export async function revokeAliasAction(formData: FormData) {
  const examId = value(formData, "examId");
  const destination = `/catalogo/${encodeURIComponent(examId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await revokeAlias(value(formData, "aliasId"), context.gateway);
  finishMutation(result, destination, "alias-revoked");
}

export async function addCompositionAction(formData: FormData) {
  const packageExamId = value(formData, "packageExamId");
  const destination = `/catalogo/${encodeURIComponent(packageExamId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await addComposition(
    { packageExamId, componentExamId: value(formData, "componentExamId") },
    context.gateway,
  );
  finishMutation(result, destination, "component-added");
}

export async function removeCompositionAction(formData: FormData) {
  const packageExamId = value(formData, "packageExamId");
  const destination = `/catalogo/${encodeURIComponent(packageExamId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await removeComposition(
    { packageExamId, componentExamId: value(formData, "componentExamId") },
    context.gateway,
  );
  finishMutation(result, destination, "component-removed");
}

export async function addTussCodeAction(formData: FormData) {
  const examId = value(formData, "examId");
  const destination = `/catalogo/${encodeURIComponent(examId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await addTussCode(
    { examId, code: value(formData, "tussCode") },
    context.gateway,
  );
  finishMutation(result, destination, "tuss-added");
}

export async function revokeTussCodeAction(formData: FormData) {
  const examId = value(formData, "examId");
  const destination = `/catalogo/${encodeURIComponent(examId)}`;
  const context = await adminContext();
  if (!context) redirect("/catalogo?error=forbidden");
  const result = await revokeTussCode(value(formData, "tussCode"), context.gateway);
  finishMutation(result, destination, "tuss-revoked");
}

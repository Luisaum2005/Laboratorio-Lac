"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  addComposition,
  approveAlias,
  createCanonicalExam,
  deactivateCanonicalExam,
  removeComposition,
  revokeAlias,
  type CatalogMutationResult,
  updateCanonicalExam,
} from "./catalog-governance";
import { createCatalogGovernanceGateway } from "./catalog-gateway";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

async function adminContext() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const appMetadata = data?.claims.app_metadata as { role?: string } | undefined;
  return appMetadata?.role === "admin" ? { gateway: createCatalogGovernanceGateway(supabase) } : null;
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

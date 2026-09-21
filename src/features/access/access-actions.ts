"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAdministrativeRetention } from "@/features/conferences/conference-retention-service";

import { inviteAuthorizedEmail, revokeAuthorizedUser, type AuthorizedAccessGateway } from "./authorized-access";

function formText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

async function administrativeGateway(): Promise<{ actorUserId: string; gateway: AuthorizedAccessGateway } | null> {
  const requester = await createSupabaseServerClient();
  const { data } = await requester.auth.getClaims();
  const claims = data?.claims;
  if (claims?.app_metadata?.role !== "admin" || !claims.sub) return null;

  const admin = createSupabaseAdminClient();
  return {
    actorUserId: String(claims.sub),
    gateway: {
      invite: async (email) => {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
        return { userId: data.user?.id ?? null, error: error?.message ?? null };
      },
      targetRole: async (userId) => {
        const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
        if (targetError || !target.user?.email) {
          return { role: null, email: null, error: targetError?.message ?? "Usuário não encontrado." };
        }
        return {
          role: target.user.app_metadata.role === "admin" ? "admin" : "operator",
          email: target.user.email,
          error: null,
        };
      },
      administratorCount: async () => {
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        return {
          count: error ? null : data.users.filter((user) => user.app_metadata.role === "admin").length,
          error: error?.message ?? null,
        };
      },
      revoke: async (userId) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        return { error: error?.message ?? null };
      },
      createAuditIntent: async (event) => {
        const { data, error } = await admin.from("access_audit_events").insert({
          action: event.action,
          actor_user_id: event.actorUserId,
          target_user_id: event.targetUserId,
          target_email: event.targetEmail,
          status: "pending",
        }).select("id").maybeSingle();
        return { auditId: data ? String(data.id) : null, error: error?.message ?? null };
      },
      completeAuditIntent: async (auditId, targetUserId) => {
        const { data, error } = await admin.from("access_audit_events").update({
          target_user_id: targetUserId,
          status: "completed",
        }).eq("id", auditId).eq("status", "pending").select("id").maybeSingle();
        return { error: error?.message ?? (data ? null : "Evento de auditoria não encontrado.") };
      },
    },
  };
}

function complete(result: { status: "success" | "invalid" | "error" }, success: string): never {
  if (result.status === "success") {
    revalidatePath("/acessos");
    redirect(`/acessos?success=${success}`);
  }
  redirect(`/acessos?error=${result.status}`);
}

export async function inviteAuthorizedEmailAction(formData: FormData) {
  const context = await administrativeGateway();
  if (!context) redirect("/catalogo?error=forbidden");
  complete(await inviteAuthorizedEmail({ email: formText(formData, "email"), actorUserId: context.actorUserId }, context.gateway), "invited");
}

export async function revokeAuthorizedUserAction(formData: FormData) {
  const context = await administrativeGateway();
  if (!context) redirect("/catalogo?error=forbidden");
  complete(await revokeAuthorizedUser({
    actorUserId: context.actorUserId,
    targetUserId: formText(formData, "userId"),
  }, context.gateway), "revoked");
}

export async function rerunRetentionAction() {
  const context = await administrativeGateway();
  if (!context) redirect("/catalogo?error=forbidden");
  try {
    await runAdministrativeRetention(context.actorUserId);
    revalidatePath("/acessos");
    redirect("/acessos?success=retention");
  } catch {
    redirect("/acessos?error=retention");
  }
}

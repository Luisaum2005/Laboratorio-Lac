import { redirect } from "next/navigation";

import { inviteAuthorizedEmailAction, revokeAuthorizedUserAction } from "@/features/access/access-actions";
import { AccessAdministrationPageView } from "@/features/access/access-administration-page";
import { accessNotice } from "@/features/access/access-notices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccessAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [query, requester] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const { data: claimsData } = await requester.auth.getClaims();
  if (claimsData?.claims.app_metadata?.role !== "admin") redirect("/catalogo?error=forbidden");

  const admin = createSupabaseAdminClient();
  const [{ data: usersData, error: usersError }, { data: events, error: eventsError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("access_audit_events").select("id,action,status,target_email,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (usersError) throw usersError;
  if (eventsError) throw eventsError;

  const users = usersData.users.flatMap((user) => {
    if (!user.email) return [];
    return [{
      id: user.id,
      email: user.email,
      role: user.app_metadata.role === "admin" ? "admin" as const : "operator" as const,
    }];
  });
  const auditEvents = (events ?? []).flatMap((event) => {
    if ((event.action !== "invited" && event.action !== "revoked") || (event.status !== "pending" && event.status !== "completed")) return [];
    return [{ id: String(event.id), action: event.action, status: event.status, targetEmail: event.target_email, createdAt: event.created_at }];
  });

  return (
    <AccessAdministrationPageView
      currentUserId={String(claimsData.claims.sub)}
      users={users}
      events={auditEvents}
      inviteAction={inviteAuthorizedEmailAction}
      revokeAction={revokeAuthorizedUserAction}
      notice={accessNotice(query)}
    />
  );
}

import { redirect } from "next/navigation";

import { inviteAuthorizedEmailAction, rerunRetentionAction, revokeAuthorizedUserAction } from "@/features/access/access-actions";
import { AccessAdministrationPageView } from "@/features/access/access-administration-page";
import { accessNotice } from "@/features/access/access-notices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizePilotMetrics } from "@/features/conferences/pilot-metrics";

export default async function AccessAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [query, requester] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const { data: claimsData } = await requester.auth.getClaims();
  if (claimsData?.claims.app_metadata?.role !== "admin") redirect("/catalogo?error=forbidden");

  const admin = createSupabaseAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: usersData, error: usersError }, { data: events, error: eventsError }, { data: retentionAudits, error: retentionError }, { data: pilotConferences, error: pilotError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("access_audit_events").select("id,action,status,target_email,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("conference_retention_audits").select("id,actor_user_id,actor_type,status,reason,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("conferences").select("status,created_at,finalized_at,extraction_result,doctor_is_manual").gte("created_at", thirtyDaysAgo).limit(1000),
  ]);
  if (usersError) throw usersError;
  if (eventsError) throw eventsError;
  if (retentionError) throw retentionError;
  if (pilotError) throw pilotError;

  const users = usersData.users.flatMap((user) => {
    if (!user.email) return [];
    return [{
      id: user.id,
      email: user.email,
      role: user.app_metadata.role === "admin" ? "admin" as const : "operator" as const,
    }];
  });
  const emailsByUserId = new Map(users.map((user) => [user.id, user.email]));
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
      rerunRetentionAction={rerunRetentionAction}
      retentionAudits={(retentionAudits ?? []).flatMap((event) => {
        if ((event.actor_type !== "system" && event.actor_type !== "administrator" && event.actor_type !== "operator") || (event.status !== "pending" && event.status !== "completed" && event.status !== "failed") || (event.reason !== "retention_expired" && event.reason !== "user_requested")) return [];
        return [{
          id: String(event.id),
          actorLabel: event.actor_type === "system" ? "Sistema" : emailsByUserId.get(String(event.actor_user_id)) ?? (event.actor_type === "operator" ? "Atendente removido" : "Administrador removido"),
          status: event.status,
          reason: event.reason,
          createdAt: event.created_at,
        }];
      })}
      pilotMetrics={summarizePilotMetrics((pilotConferences ?? []).flatMap((conference) => (
        conference.status === "draft" || conference.status === "processing" || conference.status === "finalized" || conference.status === "purged"
          ? [{ status: conference.status, createdAt: conference.created_at, finalizedAt: conference.finalized_at, extractionResult: conference.extraction_result, doctorIsManual: conference.doctor_is_manual }]
          : []
      )))}
      notice={accessNotice(query)}
    />
  );
}

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnvironment } from "./environment";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Supabase administrative access is not configured.");
  }

  const { url } = getSupabaseEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

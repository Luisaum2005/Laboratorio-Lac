import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!url || !serviceRoleKey || !adminEmail) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and INITIAL_ADMIN_EMAIL are required.",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: listedUsers, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;

let user = listedUsers.users.find(
  (candidate) => candidate.email?.toLocaleLowerCase() === adminEmail.toLocaleLowerCase(),
);

if (!user) {
  const { data, error } = adminPassword
    ? await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      })
    : await supabase.auth.admin.inviteUserByEmail(adminEmail);
  if (error) throw error;
  user = data.user;
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: "admin" },
  ...(adminPassword ? { password: adminPassword, email_confirm: true } : {}),
});
if (updateError) throw updateError;

console.log(`Administrator configured for ${adminEmail}.`);

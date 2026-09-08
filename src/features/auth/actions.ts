"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { authenticate } from "./authenticate";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const result = await authenticate(
    { email, password },
    {
      signInWithPassword: async (credentials) => {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        return { userId: data.user?.id ?? null, error: error?.message ?? null };
      },
    },
  );

  if (result.status === "rejected") {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/catalogo");
}

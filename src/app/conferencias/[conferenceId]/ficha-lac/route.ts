import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LAC_FORMS_BUCKET = "lac-forms";

export async function GET(_request: Request, context: { params: Promise<{ conferenceId: string }> }) {
  const [{ conferenceId }, requester] = await Promise.all([context.params, createSupabaseServerClient()]);
  const { data: claims } = await requester.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return new NextResponse("Não autorizado", { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: conference } = await admin.from("conferences").select("final_pdf_path")
    .eq("id", conferenceId).eq("created_by", userId).eq("status", "finalized").maybeSingle();
  if (!conference?.final_pdf_path) return new NextResponse("Ficha não encontrada", { status: 404 });
  const { data, error } = await admin.storage.from(LAC_FORMS_BUCKET).createSignedUrl(conference.final_pdf_path, 60, { download: "ficha-lac.pdf" });
  if (error || !data?.signedUrl) return new NextResponse("Não foi possível preparar o download", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

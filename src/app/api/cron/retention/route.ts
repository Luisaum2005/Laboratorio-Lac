import { NextResponse } from "next/server";

import { runScheduledRetention } from "@/features/conferences/conference-retention-service";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }
  try {
    return NextResponse.json(await runScheduledRetention());
  } catch {
    return NextResponse.json({ error: "A rotina de retenção falhou." }, { status: 500 });
  }
}

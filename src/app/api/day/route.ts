export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { dayPayload } from "@/lib/day-service";
import { effectiveDate } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? effectiveDate(new Date(), "America/Chicago");
  return NextResponse.json(await dayPayload(date));
}

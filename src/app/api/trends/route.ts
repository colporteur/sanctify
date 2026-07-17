export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { scoreRange } from "@/lib/day-service";
import { effectiveDate, addDays } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const today = effectiveDate(new Date(), "America/Chicago");
  const from = req.nextUrl.searchParams.get("from") ?? addDays(today, -30);
  const to = req.nextUrl.searchParams.get("to") ?? today;
  const rows = await scoreRange(from, to);
  return NextResponse.json(rows);
}

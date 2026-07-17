export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, gte, lte, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const Body = z.object({
  kind: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  await db
    .insert(schema.metrics)
    .values(body)
    .onConflictDoUpdate({
      target: [schema.metrics.kind, schema.metrics.date],
      set: { value: body.value },
    });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "weight";
  const from = req.nextUrl.searchParams.get("from") ?? "1970-01-01";
  const to = req.nextUrl.searchParams.get("to") ?? "2999-12-31";
  const rows = await db
    .select()
    .from(schema.metrics)
    .where(and(eq(schema.metrics.kind, kind), gte(schema.metrics.date, from), lte(schema.metrics.date, to)));
  return NextResponse.json(rows);
}

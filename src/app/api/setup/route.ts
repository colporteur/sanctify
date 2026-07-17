export const dynamic = "force-dynamic";
// One-time bootstrap: creates tables (idempotent DDL) and seeds the starter catalog.
// Protected by the app passcode: /api/setup?key=YOUR_APP_PASSCODE
// Safe to call more than once — DDL uses IF NOT EXISTS and seeds use ON CONFLICT DO NOTHING.
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { db } from "@/db";
import { seedAll } from "@/db/seed-data";
import { MIGRATION_SQL } from "@/db/migration";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key !== process.env.APP_PASSCODE) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const statements = MIGRATION_SQL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const results: string[] = [];
  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      results.push("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Re-runs hit "already exists" on constraints — that's fine.
      if (/already exists/i.test(msg)) results.push("skipped (exists)");
      else throw new Error(`DDL failed: ${msg} — statement: ${stmt.slice(0, 80)}`);
    }
  }

  await seedAll(db);

  return NextResponse.json({
    ok: true,
    ddl: `${results.length} statements (${results.filter((r) => r === "ok").length} applied)`,
    seeded: true,
    next: "Open the app and log in — your catalog is ready.",
  });
}

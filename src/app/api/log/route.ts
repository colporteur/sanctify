import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { computeAndCacheDay } from "@/lib/day-service";

const ItemLog = z.object({
  type: z.literal("item"),
  itemId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().nullable().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  na: z.boolean().optional(),
  source: z.enum(["manual", "timer", "dexcom", "ai-parse", "ai-photo"]).optional(),
});

const CleaningLog = z.object({
  type: z.literal("cleaning"),
  taskId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean().optional(),
  na: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = z.union([ItemLog, CleaningLog]).parse(await req.json());

  if (body.type === "item") {
    await db
      .insert(schema.logs)
      .values({
        itemId: body.itemId,
        date: body.date,
        value: body.value ?? null,
        detail: body.detail ?? null,
        na: body.na ?? false,
        source: body.source ?? "manual",
      })
      .onConflictDoUpdate({
        target: [schema.logs.itemId, schema.logs.date],
        set: {
          value: body.value ?? null,
          detail: body.detail ?? null,
          na: body.na ?? false,
          source: body.source ?? "manual",
          loggedAt: new Date(),
        },
      });
  } else {
    await db
      .insert(schema.cleaningLogs)
      .values({ taskId: body.taskId, date: body.date, done: body.done ?? false, na: body.na ?? false })
      .onConflictDoUpdate({
        target: [schema.cleaningLogs.taskId, schema.cleaningLogs.date],
        set: { done: body.done ?? false, na: body.na ?? false, loggedAt: new Date() },
      });
  }

  const day = await computeAndCacheDay(body.date);
  return NextResponse.json({ ok: true, day });
}

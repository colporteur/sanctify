export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadCatalog } from "@/lib/day-service";

export async function GET() {
  return NextResponse.json(await loadCatalog());
}

// Create a new scoring profile (weight change) effective from a date.
const ProfileBody = z.object({
  action: z.literal("profile"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  domainWeights: z.record(z.string(), z.number().nonnegative()),
  itemWeights: z.record(z.string(), z.number().nonnegative()),
});

// Update an item's config/schedule/active/name (calibration tinkering).
const ItemBody = z.object({
  action: z.literal("item"),
  id: z.string(),
  name: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  schedule: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

// Add a brand-new item.
const NewItemBody = z.object({
  action: z.literal("new-item"),
  id: z.string().regex(/^[a-z0-9-]+$/),
  domainId: z.string(),
  name: z.string(),
  shape: z.enum(["binary", "quantity", "limit", "checklist", "range", "rating"]),
  config: z.record(z.string(), z.unknown()),
  schedule: z.record(z.string(), z.unknown()),
  weight: z.number().positive().default(1),
});

const ModeBody = z.object({
  action: z.literal("mode"),
  mode: z.enum(["calibration", "production"]),
});

export async function POST(req: NextRequest) {
  const body = z
    .union([ProfileBody, ItemBody, NewItemBody, ModeBody])
    .parse(await req.json());

  switch (body.action) {
    case "profile": {
      await db.insert(schema.scoringProfiles).values({
        effectiveDate: body.effectiveDate,
        domainWeights: body.domainWeights,
        itemWeights: body.itemWeights,
      });
      return NextResponse.json({ ok: true });
    }
    case "item": {
      const set: Record<string, unknown> = {};
      if (body.name !== undefined) set.name = body.name;
      if (body.config !== undefined) set.config = body.config;
      if (body.schedule !== undefined) set.schedule = body.schedule;
      if (body.active !== undefined) set.active = body.active;
      await db.update(schema.items).set(set).where(eq(schema.items.id, body.id));
      return NextResponse.json({ ok: true });
    }
    case "new-item": {
      await db.insert(schema.items).values({
        id: body.id,
        domainId: body.domainId,
        name: body.name,
        shape: body.shape,
        config: body.config,
        schedule: body.schedule,
        sort: 99,
      });
      // Merge the new item's weight into the latest profile via a new profile version.
      const profiles = await db.select().from(schema.scoringProfiles);
      const latest = profiles.sort((a, b) => b.version - a.version)[0];
      if (latest) {
        await db.insert(schema.scoringProfiles).values({
          effectiveDate: new Date().toISOString().slice(0, 10),
          domainWeights: latest.domainWeights as Record<string, number>,
          itemWeights: { ...(latest.itemWeights as Record<string, number>), [body.id]: body.weight },
        });
      }
      return NextResponse.json({ ok: true });
    }
    case "mode": {
      await db.update(schema.users).set({ mode: body.mode }).where(eq(schema.users.id, "todd"));
      return NextResponse.json({ ok: true });
    }
  }
}

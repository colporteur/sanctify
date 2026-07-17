"use client";
// Items & Weights editor: sliders per domain and item; saving creates a new scoring profile.
import { useEffect, useMemo, useState } from "react";
import type { Domain, Item, ScoringProfile, CleaningTask } from "@/lib/types";

interface Catalog {
  domains: Domain[];
  items: Item[];
  tasks: CleaningTask[];
  profiles: {
    version: number;
    effectiveDate: string;
    domainWeights: Record<string, number>;
    itemWeights: Record<string, number>;
  }[];
  user: { mode: string };
}

export default function Items() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [domainW, setDomainW] = useState<Record<string, number>>({});
  const [itemW, setItemW] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((c: Catalog) => {
        setCat(c);
        const latest = [...c.profiles].sort((a, b) => b.version - a.version)[0];
        setDomainW(latest?.domainWeights ?? {});
        setItemW(latest?.itemWeights ?? {});
      });
  }, []);

  const domainTotal = useMemo(
    () => Object.values(domainW).reduce((a, b) => a + b, 0) || 1,
    [domainW]
  );

  if (!cat) return <div className="p-8 text-center text-zinc-500">Loading…</div>;

  async function save() {
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "profile",
        effectiveDate: new Date().toISOString().slice(0, 10),
        domainWeights: domainW,
        itemWeights: itemW,
      }),
    });
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleActive(item: Item) {
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "item", id: item.id, active: !item.active }),
    });
    setCat({
      ...cat!,
      items: cat!.items.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)),
    });
  }

  return (
    <main className="px-4 pt-6 space-y-4 pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">🎛️ Items & Weights</h1>
        {dirty && (
          <button onClick={save} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium">
            Save as new profile
          </button>
        )}
        {saved && <span className="text-xs text-emerald-400">New profile saved ✓</span>}
      </header>
      <p className="text-xs text-zinc-500">
        Weights are relative — the % shown is each domain&apos;s normalized share. Saving starts a new
        scoring profile from today; history keeps its old profile.
      </p>

      {cat.domains
        .sort((a, b) => a.sort - b.sort)
        .map((d) => (
          <section key={d.id} className="rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {d.icon} {d.name}
              </h2>
              <span className="text-sm text-emerald-400 font-semibold">
                {Math.round(((domainW[d.id] ?? 1) / domainTotal) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={domainW[d.id] ?? 1}
              onChange={(e) => {
                setDomainW({ ...domainW, [d.id]: Number(e.target.value) });
                setDirty(true);
              }}
              className="w-full accent-emerald-500"
            />
            <div className="space-y-1.5 pt-1">
              {cat.items
                .filter((i) => i.domainId === d.id)
                .sort((a, b) => a.sort - b.sort)
                .map((i) => (
                  <div key={i.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(i)}
                      className={`text-[10px] w-8 py-0.5 rounded ${
                        i.active ? "bg-emerald-900/60 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {i.active ? "on" : "off"}
                    </button>
                    <span className={`text-xs flex-1 ${i.active ? "text-zinc-300" : "text-zinc-600 line-through"}`}>
                      {i.name}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      value={itemW[i.id] ?? 1}
                      onChange={(e) => {
                        setItemW({ ...itemW, [i.id]: Number(e.target.value) });
                        setDirty(true);
                      }}
                      className="w-24 accent-emerald-500"
                    />
                    <span className="text-xs w-4 text-right text-zinc-400">{itemW[i.id] ?? 1}</span>
                  </div>
                ))}
            </div>
          </section>
        ))}
    </main>
  );
}

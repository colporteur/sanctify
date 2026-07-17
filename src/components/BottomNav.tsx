"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today", icon: "🏆" },
  { href: "/review", label: "Review", icon: "🌙" },
  { href: "/trends", label: "Trends", icon: "📈" },
  { href: "/items", label: "Items", icon: "🎛️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 py-2.5 text-center text-[11px] leading-tight ${
              path === t.href ? "text-emerald-400" : "text-zinc-400"
            }`}
          >
            <div className="text-lg">{t.icon}</div>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

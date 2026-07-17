"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) router.push("/");
    else setError(true);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div className="text-5xl">🏆</div>
      <h1 className="text-2xl font-semibold">Sanctify</h1>
      <form onSubmit={submit} className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="password"
          inputMode="numeric"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-center text-lg tracking-widest"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm text-center">Wrong passcode</p>}
        <button className="rounded-xl bg-emerald-600 py-3 font-medium">Enter</button>
      </form>
    </main>
  );
}

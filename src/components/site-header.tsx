"use client";
import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { logout } from "@/app/login/actions";

export function SiteHeader() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">Beleg-Prüfung</span>
          <span className="text-xs text-neutral-400">Prototyp</span>
        </div>
        <div className="flex items-center gap-3">
          <Nav />
          <form action={logout}>
            <button className="text-sm text-neutral-500 hover:text-neutral-900">Abmelden</button>
          </form>
        </div>
      </div>
    </header>
  );
}

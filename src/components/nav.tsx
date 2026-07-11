"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/belege", label: "Belege" },
  { href: "/bank", label: "Bank" },
  { href: "/abgleich", label: "Abgleich" },
  { href: "/lieferanten", label: "Lieferanten" },
  { href: "/reverse-charge", label: "§ 13b" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

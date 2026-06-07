"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function NavLinkItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 9px", borderRadius: 99, fontSize: 13, fontWeight: 600,
        color: active ? "#000" : hovered ? "var(--wc-text-1)" : "var(--wc-text-2)",
        background: active ? "var(--wc-green)" : hovered ? "var(--wc-surface-alt)" : "none",
        textDecoration: "none", transition: "all 0.15s",
      }}
    >
      {label}
    </Link>
  );
}

export function NavLinks({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  const links = [
    { href: "/",                label: "Matches" },
    { href: "/leaderboard",     label: "Leaderboard" },
    { href: "/leagues",         label: "Leagues" },
    ...(userId ? [{ href: "/my-predictions", label: "My Picks" }] : []),
  ];

  return (
    <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}>
      {links.map(link => (
        <NavLinkItem key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
      ))}
    </div>
  );
}

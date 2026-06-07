"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Users, CheckSquare, Star } from "lucide-react";

export function BottomNav({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  const items = [
    { href: "/",            Icon: Home,        label: "Matches" },
    { href: "/leaderboard", Icon: Trophy,       label: "Ranks" },
    { href: "/leagues",     Icon: Users,        label: "Leagues" },
    ...(userId ? [
      { href: "/my-predictions", Icon: CheckSquare, label: "My Picks" },
      { href: "/captain",        Icon: Star,         label: "Captain" },
    ] : []),
  ];

  return (
    <nav className="bottom-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, height: 60,
      background: "rgba(6,16,30,0.97)",
      backdropFilter: "blur(20px)",
      borderTop: "1px solid var(--wc-border)",
    }}>
      {items.map(({ href, Icon, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className={`bottom-nav-item${active ? " active" : ""}`}>
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

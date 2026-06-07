import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { Trophy } from "lucide-react";
import { NavAuthButtons } from "@/components/NavAuthButtons";
import { NavLinks } from "@/components/NavLinks";
import { BottomNav } from "@/components/BottomNav";
import { getDbUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/db";

export async function NavBar() {
  const { userId } = await auth();

  // Fetch captain team flag for navbar
  let captainIso: string | null = null;
  if (userId) {
    const dbUser = await getDbUser();
    if (dbUser?.captain_team_id) {
      const { data: ct } = await supabaseAdmin
        .from("teams")
        .select("iso_code")
        .eq("id", dbUser.captain_team_id)
        .single();
      captainIso = ct?.iso_code ?? null;
    }
  }

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56,
        background: "rgba(6,16,30,0.92)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--wc-border)",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", height: "100%", display: "flex", alignItems: "center", padding: "0 16px", gap: 0 }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", marginRight: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--wc-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="2"/>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.58 0 3.04.46 4.26 1.25L14 8H10L7.74 5.25C8.96 4.46 10.42 4 12 4zm-5.5 3.03L8.5 9.5l-2 3H3.26C3.93 10.2 4.99 8.43 6.5 7.03zM4 12c0-.18.01-.35.02-.52L5 12l2 3-1.5 3.5C4.56 17.17 4 14.67 4 12zm3 7.22L8.5 16h3l1 3-1.5 1.97C9.3 20.64 7.6 20.06 7 19.22zm8 1.78-1.5-1.97 1-3h3l1.5 3.22c-.6.84-2.3 1.42-4 1.75zm4.5-3.5L20 12l1-.52c.01.17.02.34.02.52 0 2.67-.56 5.17-1.52 6.5zm-1.5-8L21.74 11 21 11.5l-2-3 2-2.47C19.01 8.43 20.07 10.2 20.74 12.5l-.24-1zM12 10l2 2-2 2-2-2 2-2z" fill="#000" opacity=".4"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--wc-text-1)", letterSpacing: "-0.02em" }}>
              Predict <span style={{ color: "var(--wc-green)" }}>2026</span>
            </span>
          </Link>

          {/* Desktop nav — client component for active state */}
          <NavLinks userId={userId} />

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {userId ? (
              <>
                <Link href="/captain" title={captainIso ? "Your captain pick" : "Pick a captain"} style={{
                  display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
                  borderRadius: 7, overflow: "hidden",
                  ...(captainIso
                    ? {}
                    : { padding: "5px 10px", background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", color: "var(--wc-text-2)", fontSize: 12, fontWeight: 700 }
                  ),
                }}>
                  {captainIso
                    ? <img src={`https://flagcdn.com/w80/${captainIso}.png`} alt="Captain" style={{ height: 28, width: 40, objectFit: "cover", display: "block" }} />
                    : <><Trophy size={13} strokeWidth={2} /><span>Captain</span></>
                  }
                </Link>
                <UserButton />
              </>
            ) : (
              <NavAuthButtons />
            )}
          </div>
        </div>
      </nav>
      <BottomNav userId={userId} />
    </>
  );
}

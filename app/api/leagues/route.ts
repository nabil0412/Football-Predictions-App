import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  
  

  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { action, name, inviteCode } = await req.json();

  if (action === "create") {
    const code = nanoid(8).toUpperCase();
    const { data: league, error } = await supabaseAdmin
      .from("leagues").insert({ name, invite_code: code, owner_id: dbUser.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("league_members").insert({ league_id: league.id, user_id: dbUser.id });
    return NextResponse.json({ league });
  }

  if (action === "join") {
    const { data: league } = await supabaseAdmin.from("leagues").select().eq("invite_code", inviteCode).single();
    if (!league) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    const { data: existing } = await supabaseAdmin
      .from("league_members").select("id").eq("league_id", league.id).eq("user_id", dbUser.id).maybeSingle();
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 400 });
    await supabaseAdmin.from("league_members").insert({ league_id: league.id, user_id: dbUser.id });
    return NextResponse.json({ league });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

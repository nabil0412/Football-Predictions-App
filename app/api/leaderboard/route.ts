import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

export async function GET() {
  const cached = await redis.get(CACHE_KEYS.globalLeaderboard).catch(() => null);
  if (cached) return NextResponse.json(cached);

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, total_score")
    .order("total_score", { ascending: false })
    .limit(100);

  await redis.set(CACHE_KEYS.globalLeaderboard, data ?? [], { ex: CACHE_TTL.leaderboard }).catch(() => {});
  return NextResponse.json(data ?? []);
}

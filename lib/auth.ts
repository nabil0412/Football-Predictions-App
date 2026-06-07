import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";

type DbUser = {
  id: number;
  name: string;
  email: string;
  total_score: number;
  captain_team_id: number | null;
  clerk_id: string | null;
};

export async function getDbUser(): Promise<DbUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, email, total_score, captain_team_id, clerk_id")
    .eq("clerk_id", userId)
    .maybeSingle();

  return data as DbUser | null;
}

export async function getOrCreateDbUser(): Promise<DbUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, name, email, total_score, captain_team_id, clerk_id")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (existing) return existing as DbUser;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name =
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
    email.split("@")[0];

  const { data: created } = await supabaseAdmin
    .from("users")
    .insert({ email, name, clerk_id: userId })
    .select()
    .single();

  return created as DbUser | null;
}

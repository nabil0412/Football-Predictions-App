import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/db";
import { AdminPanel } from "@/components/AdminPanel";

const ADMIN_EMAIL = "abdelrahman.nabil04@gmail.com";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL)) {
    redirect("/");
  }
  const [{ data: allMatches }, { data: allTeams }] = await Promise.all([
    supabaseAdmin.from("matches").select("id, kickoff_time, status, stage, team_a_score, team_b_score, team_a_id, team_b_id").order("kickoff_time"),
    supabaseAdmin.from("teams").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <AdminPanel matches={allMatches ?? []} teams={allTeams ?? []} />
    </div>
  );
}

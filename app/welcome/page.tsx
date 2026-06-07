import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/db";

export default async function WelcomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  // Upsert DB user row on first login
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (!existing) {
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
      email.split("@")[0];
    await supabaseAdmin.from("users").insert({ email, name, clerk_id: userId });
  }

  redirect("/");
}

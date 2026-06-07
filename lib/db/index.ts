import { createClient } from "@supabase/supabase-js";

// Service-role client — full DB access, server-side only (never expose to browser)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Re-export schema types for use across the app
export * from "./schema-types";

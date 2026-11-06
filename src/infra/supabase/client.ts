import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Client with the public (anon) key. Safe on the server and in the browser. Never use service_role here. */
export function createPublicSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing (see .env.example)");
  return createClient(url, key, { auth: { persistSession: false } });
}

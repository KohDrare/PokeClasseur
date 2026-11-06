/* Supabase client (loaded on demand by account.js, never when the cloud is not configured). */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",          // the e-mail link comes back as ?code=… so it never clashes with our #/routes
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

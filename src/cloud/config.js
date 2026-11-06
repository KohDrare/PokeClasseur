/* Cloud settings, read at build time from .env.local (see .env.example). Tiny on purpose:
   the Supabase library itself is only downloaded when this is true. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

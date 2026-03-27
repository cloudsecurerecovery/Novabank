import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://vbbdahnsixrmcpkaismc.supabase.co";
export const SUPABASE_PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_MMD1wIzEyPgc8n6k7AzZUw_GG1-sBn3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND PUBLIC KEY LATER
export const SUPABASE_URL = "https://vbbdahnsixrmcpkaismc.supabase.co";
export const SUPABASE_PUBLIC_KEY = "sb_publishable_MMD1wIzEyPgc8n6k7AzZUw_GG1-sBn3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

import type { DataAdapter } from "@/lib/types";
import { demoAdapter } from "@/lib/data/demo";
import { isSupabaseConfigured, supabaseAdapter } from "@/lib/data/supabase";

/** Escolhe o back-end: Supabase quando as chaves existem, senao modo demo. */
export function getAdapter(): DataAdapter {
  return isSupabaseConfigured() ? supabaseAdapter : demoAdapter;
}

export { isSupabaseConfigured };

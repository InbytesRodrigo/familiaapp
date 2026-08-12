import { createClient } from '@supabase/supabase-js';

// As chaves vêm das variáveis de ambiente (veja .env.example)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente pronto para uso, ou null se o Supabase ainda não foi configurado. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

/** True quando o app está conectado ao Supabase. */
export const isSupabaseConfigured = supabase !== null;

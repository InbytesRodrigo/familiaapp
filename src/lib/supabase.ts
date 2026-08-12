import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexão com o Supabase.
 *
 * Ordem de prioridade:
 * 1. Credenciais salvas pelo usuário em Configurações → Banco de Dados (localStorage) — vale para qualquer hospedagem (Netlify, Pages, etc.) sem precisar rebuildar;
 * 2. Variáveis de ambiente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) injetadas no build.
 *
 * A chave anon é pública por design (fica no app de qualquer forma) — o que protege
 * os dados são as políticas de segurança (RLS) do banco.
 */
const STORAGE_KEY = 'familiaapp:supabase-conn';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let usingEnv = true;

interface StoredConn {
  url: string;
  anonKey: string;
}

const readStored = (): StoredConn | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConn>;
    if (
      parsed &&
      typeof parsed.url === 'string' &&
      typeof parsed.anonKey === 'string' &&
      parsed.url.trim() &&
      parsed.anonKey.trim()
    ) {
      return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
    }
  } catch {
    /* ignora JSON inválido */
  }
  return null;
};

const initClient = () => {
  const stored = readStored();
  const url = stored?.url ?? envUrl;
  const anonKey = stored?.anonKey ?? envAnonKey;
  usingEnv = !stored;
  client = url && anonKey ? createClient(url, anonKey) : null;
};

initClient();

/** Cliente atual do Supabase (ou null se ainda não configurado). */
export const getSupabase = (): SupabaseClient | null => client;

/** Configuração atual (para preencher a tela de Configurações). */
export const getConnectionConfig = (): { url: string; anonKey: string; fromEnv: boolean } => {
  const stored = readStored();
  return {
    url: stored?.url ?? envUrl ?? '',
    anonKey: stored?.anonKey ?? envAnonKey ?? '',
    fromEnv: usingEnv,
  };
};

/** Conecta (ou troca) em tempo de execução e salva no navegador. */
export const setSupabaseConnection = (url: string, anonKey: string): SupabaseClient | null => {
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();
  if (!trimmedUrl || !trimmedKey) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: trimmedUrl, anonKey: trimmedKey }));
  } catch {
    /* armazenamento indisponível — segue sem salvar */
  }
  client = createClient(trimmedUrl, trimmedKey);
  usingEnv = false;
  return client;
};

/** Remove a configuração manual e volta ao padrão do build. */
export const clearSupabaseConnection = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
  initClient();
};

/** True quando existe um cliente configurado (por env ou manual). */
export const isSupabaseConfigured = (): boolean => client !== null;

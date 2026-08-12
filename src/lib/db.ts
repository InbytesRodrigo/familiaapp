import { getSupabase } from './supabase';
import { initialEvents, initialShoppingItems, initialUsers } from '../data/initialData';
import type { Aviso, FamilyEvent, MetodoLembrete, ShoppingItem, User } from '../types';

const SEEDED_KEY = 'familiaapp:seeded';

/** Gera um id UUID (válido para as colunas uuid do Supabase). */
export const newId = (): string => crypto.randomUUID();

type Row = Record<string, unknown>;

// ——— Mapeamento: tabelas <-> tipos do app ———

const userToDb = (u: User): Row => ({
  id: u.id,
  nome: u.name,
  papel: u.role,
  cor: u.color,
  avatar: u.avatar,
});

const dbToUser = (row: Row): User => ({
  id: String(row.id),
  name: String(row.nome ?? ''),
  role: String(row.papel ?? ''),
  color: String(row.cor ?? '#a855f7'),
  avatar: String(row.avatar ?? '👤'),
});

const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const eventToDb = (e: FamilyEvent): Row => ({
  id: e.id,
  titulo: e.title,
  data: localDate(e.date),
  hora: e.time,
  hora_fim: e.endTime ?? null,
  membro_id: e.userId,
  criado_por: e.createdBy,
});

const dbToEvent = (row: Row): FamilyEvent => {
  const [y, m, d] = String(row.data ?? '').split('-').map(Number);
  return {
    id: String(row.id),
    title: String(row.titulo ?? ''),
    date: new Date(y || 2000, (m || 1) - 1, d || 1),
    time: String(row.hora ?? '').slice(0, 5),
    endTime: row.hora_fim ? String(row.hora_fim).slice(0, 5) : undefined,
    userId: String(row.membro_id ?? ''),
    createdBy: String(row.criado_por ?? ''),
  };
};

const itemToDb = (i: ShoppingItem): Row => ({
  id: i.id,
  nome: i.name,
  quantidade: i.quantity,
  preco: i.price,
  comprado: i.archived,
  membro_id: i.userId,
  data: i.date ?? null,
});

const dbToItem = (row: Row): ShoppingItem => ({
  id: String(row.id),
  name: String(row.nome ?? ''),
  quantity: Number(row.quantidade ?? 1),
  price: Number(row.preco ?? 0),
  archived: Boolean(row.comprado),
  userId: String(row.membro_id ?? ''),
  date: row.data ? String(row.data) : undefined,
});

// ——— Carga inicial + seed dos dados demo ———

export interface FamilyData {
  users: User[];
  events: FamilyEvent[];
  items: ShoppingItem[];
}

/** Carrega tudo do Supabase; semeia os dados iniciais se o banco estiver vazio. Retorna null se não configurado. */
export const loadFromSupabase = async (): Promise<FamilyData | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const [u, e, i] = await Promise.all([
      supabase.from('familia').select('*').order('criado_em'),
      supabase.from('compromissos').select('*').order('data').order('hora'),
      supabase.from('mercado').select('*').order('criado_em'),
    ]);

    const users = (u.data ?? []).map(dbToUser);
    const events = (e.data ?? []).map(dbToEvent);
    const items = (i.data ?? []).map(dbToItem);

    // Primeira vez: banco vazio -> semeia os dados de exemplo
    if (users.length === 0 && events.length === 0 && items.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
      const seeded = await seedInitialData();
      if (seeded) return seeded;
    }

    return { users, events, items };
  } catch (err) {
    console.error('[Supabase] Falha ao carregar dados:', err);
    return null;
  }
};

const seedInitialData = async (): Promise<FamilyData | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const users: User[] = initialUsers.map((u) => ({ ...u, id: newId() }));
    const { data: inserted, error: uErr } = await supabase.from('familia').insert(users.map(userToDb)).select();
    if (uErr) throw uErr;

    const idByName = new Map<string, string>((inserted ?? []).map((r) => [String(r.nome), String(r.id)]));
    const memberId = (refId: string) => {
      const name = initialUsers.find((u) => u.id === refId)?.name ?? '';
      return idByName.get(name) ?? newId();
    };

    const events: FamilyEvent[] = initialEvents.map((e) => ({
      ...e,
      id: newId(),
      userId: memberId(e.userId),
      createdBy: memberId(e.createdBy),
    }));
    const { error: eErr } = await supabase.from('compromissos').insert(events.map(eventToDb));
    if (eErr) throw eErr;

    const items: ShoppingItem[] = initialShoppingItems.map((i) => ({
      ...i,
      id: newId(),
      userId: memberId(i.userId),
    }));
    const { error: iErr } = await supabase.from('mercado').insert(items.map(itemToDb));
    if (iErr) throw iErr;

    localStorage.setItem(SEEDED_KEY, '1');
    return {
      users: (inserted ?? []).map(dbToUser),
      events,
      items,
    };
  } catch (err) {
    console.error('[Supabase] Falha ao semear dados iniciais:', err);
    return null;
  }
};

// ——— Sincronização (upsert total por coleção — listas pequenas) ———

/** Envia todos os membros (upsert). Retorna true se gravou com sucesso. */
export const syncUsers = async (users: User[]): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('familia').upsert(users.map(userToDb));
    if (error) {
      console.error('[Supabase] Falha ao sincronizar família:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar família:', err);
    return false;
  }
};

export const deleteUsers = async (ids: string[]): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return true;
  try {
    const { error } = await supabase.from('familia').delete().in('id', ids);
    if (error) {
      console.error('[Supabase] Falha ao remover membros:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao remover membros:', err);
    return false;
  }
};

/** Envia todos os compromissos (upsert). Retorna true se gravou com sucesso. */
export const syncEvents = async (events: FamilyEvent[]): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('compromissos').upsert(events.map(eventToDb));
    if (error) {
      console.error('[Supabase] Falha ao sincronizar compromissos:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar compromissos:', err);
    return false;
  }
};

export const deleteEvents = async (ids: string[]): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return true;
  try {
    const { error } = await supabase.from('compromissos').delete().in('id', ids);
    if (error) {
      console.error('[Supabase] Falha ao excluir compromissos:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao excluir compromissos:', err);
    return false;
  }
};

/** Envia todos os itens do mercado (upsert). Retorna true se gravou com sucesso. */
export const syncItems = async (items: ShoppingItem[]): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('mercado').upsert(items.map(itemToDb));
    if (error) {
      console.error('[Supabase] Falha ao sincronizar mercado:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar mercado:', err);
    return false;
  }
};

// ——— Avisos entre membros (lido/não lido, com foto do remetente) ———

const avisoToDb = (a: Aviso): Row => ({
  id: a.id,
  titulo: a.titulo,
  mensagem: a.mensagem,
  de_id: a.deId,
  para_id: a.paraId,
  tipo: a.tipo,
  ref_id: a.refId ?? null,
  lida: a.lida,
  criado_em: a.criadoEm,
});

const dbToAviso = (row: Row): Aviso => ({
  id: String(row.id),
  titulo: String(row.titulo ?? ''),
  mensagem: String(row.mensagem ?? ''),
  deId: String(row.de_id ?? ''),
  paraId: String(row.para_id ?? 'all'),
  tipo: (String(row.tipo ?? 'aviso') as Aviso['tipo']) || 'aviso',
  refId: row.ref_id ? String(row.ref_id) : undefined,
  lida: Boolean(row.lida),
  criadoEm: String(row.criado_em ?? ''),
});

/** Carrega os avisos (mais recentes primeiro). */
export const loadAvisos = async (): Promise<Aviso[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('avisos')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[Supabase] Falha ao carregar avisos:', error.message);
      return [];
    }
    return (data ?? []).map(dbToAviso);
  } catch (err) {
    console.error('[Supabase] Falha ao carregar avisos:', err);
    return [];
  }
};

/** Grava um aviso novo (upsert). Retorna o aviso salvo ou null. */
export const saveAviso = async (aviso: Aviso): Promise<Aviso | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('avisos')
      .upsert(avisoToDb(aviso))
      .select()
      .single();
    if (error) {
      console.error('[Supabase] Falha ao salvar aviso:', error.message);
      return null;
    }
    return dbToAviso(data);
  } catch (err) {
    console.error('[Supabase] Falha ao salvar aviso:', err);
    return null;
  }
};

/** Marca um aviso como lido. */
export const markAvisoLida = async (id: string): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase || !id) return;
  try {
    await supabase.from('avisos').update({ lida: true }).eq('id', id);
  } catch (err) {
    console.error('[Supabase] Falha ao marcar aviso como lido:', err);
  }
};

/** Marca todos os avisos como lidos. */
export const markAllAvisosLidas = async (): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('avisos').update({ lida: true }).eq('lida', false);
  } catch (err) {
    console.error('[Supabase] Falha ao marcar avisos como lidos:', err);
  }
};

// ——— Configuração do app (métodos de lembrete, etc.) ———

const LEMBRETES_CONFIG_KEY = 'lembretes';

/** Salva os métodos de lembrete no banco (o cron do servidor lê daqui). */
export const saveMetodosLembrete = async (metodos: MetodoLembrete[]): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('configuracao').upsert({
      chave: LEMBRETES_CONFIG_KEY,
      valor: metodos.map((m) => ({ minutosAntes: m.minutosAntes })),
    });
  } catch (err) {
    console.error('[Supabase] Falha ao salvar configuração de lembretes:', err);
  }
};

/** Lê os métodos de lembrete salvos no banco (para usar ao abrir em outro aparelho). */
export const loadMetodosLembrete = async (): Promise<MetodoLembrete[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('configuracao')
      .select('valor')
      .eq('chave', LEMBRETES_CONFIG_KEY)
      .maybeSingle();
    if (error || !data?.valor) return [];
    const list = data.valor as { minutosAntes?: number }[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => typeof m.minutosAntes === 'number' && m.minutosAntes > 0)
      .map((m) => ({ id: crypto.randomUUID(), minutosAntes: m.minutosAntes as number }));
  } catch {
    return [];
  }
};

// ——— Web Push (notificações que funcionam mesmo com o app fechado / PWA instalado) ———

const VAPID_CACHE_KEY = 'familiapp:vapid-public';

/**
 * Chave pública VAPID do servidor de push (Edge Function).
 * Vem da função e fica em cache no navegador para não buscar toda hora.
 */
export const getVapidPublicKey = async (): Promise<string | null> => {
  const cached = localStorage.getItem(VAPID_CACHE_KEY);
  if (cached) return cached;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    // Importante: nesta versão do supabase-js, invoke sem corpo usa POST —
    // passamos method GET explícito para a função devolver a chave pública.
    const { data, error } = await supabase.functions.invoke('send-push', { method: 'GET' });
    const key = data?.publicKey;
    if (!error && typeof key === 'string' && key) {
      localStorage.setItem(VAPID_CACHE_KEY, key);
      return key;
    }
    return null;
  } catch (err) {
    console.error('[Supabase] Falha ao obter chave VAPID:', err);
    return null;
  }
};

/** Salva (ou atualiza) a assinatura de push deste aparelho no banco. */
export const savePushSubscription = async (sub: PushSubscription): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const json = sub.toJSON() as { endpoint?: string; keys?: { auth?: string; p256dh?: string } };
  if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh) return false;
  try {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: json.endpoint,
        keys_auth: json.keys.auth,
        keys_p256dh: json.keys.p256dh,
      },
      { onConflict: 'endpoint' },
    );
    if (error) {
      console.error('[Supabase] Falha ao salvar assinatura de push:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao salvar assinatura de push:', err);
    return false;
  }
};

/** Remove a assinatura de push deste aparelho do banco. */
export const deletePushSubscription = async (endpoint: string): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase || !endpoint) return;
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err) {
    console.error('[Supabase] Falha ao remover assinatura de push:', err);
  }
};

/**
 * Envia uma notificação push para TODOS os aparelhos assinados (Edge Function).
 * Assim a família é avisada mesmo com o app fechado ou instalado como PWA.
 */
export const sendPushNotification = async (
  title: string,
  body: string,
  url = '/',
  tag = 'familiapp-push',
): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.functions.invoke('send-push', { body: { title, body, url, tag } });
  } catch (err) {
    console.error('[Supabase] Falha ao enviar push:', err);
  }
};

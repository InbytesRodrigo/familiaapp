import { supabase } from './supabase';
import { initialEvents, initialShoppingItems, initialUsers } from '../data/initialData';
import type { FamilyEvent, ShoppingItem, User } from '../types';

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
});

const dbToItem = (row: Row): ShoppingItem => ({
  id: String(row.id),
  name: String(row.nome ?? ''),
  quantity: Number(row.quantidade ?? 1),
  price: Number(row.preco ?? 0),
  archived: Boolean(row.comprado),
  userId: String(row.membro_id ?? ''),
});

// ——— Carga inicial + seed dos dados demo ———

export interface FamilyData {
  users: User[];
  events: FamilyEvent[];
  items: ShoppingItem[];
}

/** Carrega tudo do Supabase; semeia os dados iniciais se o banco estiver vazio. Retorna null se não configurado. */
export const loadFromSupabase = async (): Promise<FamilyData | null> => {
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

export const syncUsers = async (users: User[]): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('familia').upsert(users.map(userToDb));
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar família:', err);
  }
};

export const deleteUsers = async (ids: string[]): Promise<void> => {
  if (!supabase || ids.length === 0) return;
  try {
    await supabase.from('familia').delete().in('id', ids);
  } catch (err) {
    console.error('[Supabase] Falha ao remover membros:', err);
  }
};

export const syncEvents = async (events: FamilyEvent[]): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('compromissos').upsert(events.map(eventToDb));
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar compromissos:', err);
  }
};

export const deleteEvents = async (ids: string[]): Promise<void> => {
  if (!supabase || ids.length === 0) return;
  try {
    await supabase.from('compromissos').delete().in('id', ids);
  } catch (err) {
    console.error('[Supabase] Falha ao excluir compromissos:', err);
  }
};

export const syncItems = async (items: ShoppingItem[]): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('mercado').upsert(items.map(itemToDb));
  } catch (err) {
    console.error('[Supabase] Falha ao sincronizar mercado:', err);
  }
};

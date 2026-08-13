export interface User {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar: string;
}

export interface FamilyEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  endTime?: string;
  userId: string;
  createdBy: string;
  /** "Alertar o parceiro": compromisso importante que notifica até ser visualizado. */
  alertar?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  archived: boolean;
  userId: string;
  /** Data opcional (YYYY-MM-DD) — item que precisa para uma data específica. */
  date?: string;
}

/** Aviso/mensagem entre membros, com estado de lido/não lido. */
export interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  deId: string;
  paraId: string; // 'all' ou id de um membro
  tipo: 'evento' | 'mercado' | 'aviso' | 'presenca';
  refId?: string;
  lida: boolean;
  criadoEm: string; // ISO
}

/** Método de lembrete do push: avisar X minutos antes do compromisso. */
export interface MetodoLembrete {
  id: string;
  minutosAntes: number;
}

/** Valores aceitos para "avisar X antes" na configuração de lembretes. */
export const METODO_LEMBRETE_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 360, label: '6 horas antes' },
  { value: 720, label: '12 horas antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 2880, label: '2 dias antes' },
];

export interface EvolutionConfig {
  url: string;
  instance: string;
  apiKey: string;
  number: string;
}

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: ToastType;
}

/**
 * Callback que processa um aviso (toast + aviso persistente + push + WhatsApp).
 * paraId: 'all' ou id de um membro; tipo/refId identificam o aviso.
 */
export type Notify = (
  action: string,
  details: string,
  paraId?: string,
  tipo?: Aviso['tipo'],
  refId?: string,
) => void;

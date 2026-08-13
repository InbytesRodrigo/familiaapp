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
  /** Descrição/explicações do compromisso (opcional). */
  descricao?: string;
  date: Date;
  time: string;
  endTime?: string;
  userId: string;
  createdBy: string;
  /** "Alertar o parceiro": compromisso importante que notifica até ser visualizado. */
  alertar?: boolean;
  /** Gasto compartilhado que gerou este compromisso (parcelas) — usado p/ sincronizar o calendário. */
  gastoId?: string;
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
  /** Data em que a compra foi concluída (YYYY-MM-DD) — base do relatório mensal. */
  compradoEm?: string;
  /** Data de criação no banco (fallback do relatório para itens antigos). */
  criadoEm?: string;
}

/** Aviso/mensagem entre membros, com estado de lido/não lido. */
export interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  deId: string;
  paraId: string; // 'all' ou id de um membro
  tipo: 'evento' | 'mercado' | 'aviso' | 'presenca' | 'filho' | 'gasto';
  refId?: string;
  lida: boolean;
  criadoEm: string; // ISO
}

/** Compromisso do Filho: lista com alerta até visualizar e conclusão com data. */
export interface ChildCommitment {
  id: string;
  title: string;
  /** Descrição/explicações do compromisso (opcional). */
  descricao?: string;
  /** Data do compromisso (YYYY-MM-DD) — opcional. */
  date?: string;
  /** Alerta o parceiro até visualizar (importante). */
  alertar: boolean;
  concluido: boolean;
  /** Data em que foi concluído (YYYY-MM-DD) — registrada ao marcar concluído. */
  dataConclusao?: string;
}

/** Gasto compartilhado: valor, parcelas, método e status quitado. */
export interface Gasto {
  id: string;
  /** Nome do gasto/compromisso. */
  titulo: string;
  /** Valor total (R$). */
  valor: number;
  /** Data da compra (YYYY-MM-DD) — base das datas das parcelas. */
  data: string;
  /** Quantidade de parcelas (1 = à vista). */
  parcelas: number;
  /** Método de pagamento (Pix, Cartão...). */
  metodo: string;
  /** Observação/descrição (opcional). */
  observacao?: string;
  /** Quitado: todas as parcelas pagas. */
  quitado: boolean;
  /** Quem cadastrou. */
  criadoPor?: string;
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

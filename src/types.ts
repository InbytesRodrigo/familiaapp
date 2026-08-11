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
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  archived: boolean;
  userId: string;
}

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

/** Callback que processa um aviso (toast + push + WhatsApp). */
export type Notify = (action: string, details: string) => void;

/* Utilitários de notificações push e lembretes agendados. */

const METODOS_KEY = 'familiapp:metodos-lembrete';
const VAPID_KEY = 'familiapp:vapid-key';
const SUBSCRIPTION_KEY = 'familiapp:push-subscription';

import { METODO_LEMBRETE_OPTIONS } from '../types';
import type { MetodoLembrete, ShoppingItem } from '../types';
import { newId } from '../lib/db';

export const getMetodoOptions = () => METODO_LEMBRETE_OPTIONS;

/**
 * Métodos de lembrete configurados (cada um = "avisar X minutos antes").
 * Padrão: 1 dia, 1 hora e 15 minutos antes.
 */
export const getMetodosLembrete = (): MetodoLembrete[] => {
  try {
    const raw = localStorage.getItem(METODOS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as { id?: string; minutosAntes?: number }[];
      if (Array.isArray(list)) {
        const valid = list
          .filter((m) => typeof m.minutosAntes === 'number' && m.minutosAntes > 0)
          .map((m) => ({ id: m.id || newId(), minutosAntes: m.minutosAntes! }));
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    /* JSON inválido — usa o padrão */
  }
  return [
    { id: newId(), minutosAntes: 1440 },
    { id: newId(), minutosAntes: 60 },
    { id: newId(), minutosAntes: 15 },
  ];
};

export const setMetodosLembrete = (metodos: MetodoLembrete[]): void => {
  try {
    localStorage.setItem(METODOS_KEY, JSON.stringify(metodos));
  } catch {
    /* armazenamento indisponível */
  }
};

/** O navegador suporta service worker + push. */
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

/**
 * O navegador suporta lembretes agendados que disparam com o app fechado?
 * Pergunta ao service worker (contexto onde o TimestampTrigger existe).
 */
export const isScheduledSupported = (): Promise<boolean> =>
  new Promise((resolve) => {
    getServiceWorker().then((sw) => {
      if (!sw || !sw.active) {
        resolve(false);
        return;
      }
      const timeout = setTimeout(() => resolve(false), 1500);
      const listener = (event: MessageEvent) => {
        if (event.data?.type === 'SCHEDULED_SUPPORTED') {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('message', listener);
          resolve(Boolean(event.data.supported));
        }
      };
      navigator.serviceWorker.addEventListener('message', listener);
      sw.active.postMessage({ type: 'CHECK_SCHEDULED' });
    });
  });


/** Pede permissão de notificação; retorna true se concedida. */
export const requestPushPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
};

export const getServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
};

export interface ReminderSpec {
  id: string;
  at: number;
  title: string;
  body: string;
}

interface ReminderEventLike {
  id: string;
  title: string;
  date: Date;
  time: string;
}

/**
 * Calcula os lembretes desejados a partir dos eventos (um por método configurado)
 * e envia ao service worker, que agenda via Notification Triggers
 * (disparam mesmo com o app fechado). Também agenda os itens do mercado
 * que têm data específica.
 */
export const scheduleEventReminders = async (
  events: ReminderEventLike[],
  items: ShoppingItem[],
): Promise<void> => {
  const metodos = getMetodosLembrete();
  const sw = await getServiceWorker();
  if (!sw || !sw.active) return;

  const specs: ReminderSpec[] = [];
  const now = Date.now();
  const horizon = now + 45 * 24 * 60 * 60 * 1000; // próximos 45 dias

  // Compromissos: um lembrete para cada método ("quantas vezes, quanto antes")
  for (const e of events) {
    const [h, m] = e.time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const start =
      new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate(), h, m).getTime();
    for (const metodo of metodos) {
      const at = start - metodo.minutosAntes * 60 * 1000;
      if (at > now && at < horizon) {
        specs.push({
          id: `ev-${e.id}-${metodo.minutosAntes}`,
          at,
          title: `Lembrete: ${e.title}`,
          body: `Começa às ${e.time} — FamíliaApp.`,
        });
      }
    }
  }

  // Mercado: item com data específica -> lembrete às 09:00 do dia
  for (const item of items) {
    if (item.archived || !item.date) continue;
    const [y, mo, d] = item.date.split('-').map(Number);
    if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) continue;
    const at = new Date(y, mo - 1, d, 9, 0).getTime();
    if (at > now && at < horizon) {
      specs.push({
        id: `item-${item.id}`,
        at,
        title: 'Lembrete de mercado',
        body: `Hoje: "${item.name}" está na lista de compras.`,
      });
    }
  }

  sw.active.postMessage({ type: 'SYNC_REMINDERS', specs });
};

/** Mostra uma notificação de teste imediatamente (via service worker). */
export const sendTestNotification = async (): Promise<boolean> => {
  const sw = await getServiceWorker();
  if (!sw || !sw.active) return false;
  sw.active.postMessage({
    type: 'TEST_NOTIFICATION',
    title: 'FamíliaApp 🎉',
    body: 'Notificação de teste! O push está funcionando.',
  });
  return true;
};

/** Agenda uma notificação de teste para daqui a 15 segundos (mesmo com o app fechado). */
export const sendScheduledTest = async (): Promise<boolean> => {
  const sw = await getServiceWorker();
  if (!sw || !sw.active) return false;
  sw.active.postMessage({ type: 'TEST_SCHEDULED' });
  return true;
};

/** Assina para Web Push real (requer chave VAPID pública de um servidor). */
export const subscribeToPush = async (vapidKey: string): Promise<PushSubscription | null> => {
  const sw = await getServiceWorker();
  if (!sw || !vapidKey.trim()) return null;
  try {
    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey.trim()),
    });
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription));
    return subscription;
  } catch {
    return null;
  }
};

export const getStoredSubscription = (): PushSubscription | null => {
  const raw = localStorage.getItem(SUBSCRIPTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PushSubscription;
  } catch {
    return null;
  }
};

/** Remove a assinatura salva no navegador (ao desativar o push neste aparelho). */
export const clearStoredSubscription = (): void => {
  localStorage.removeItem(SUBSCRIPTION_KEY);
};

export const getVapidKey = (): string => localStorage.getItem(VAPID_KEY) ?? '';
export const setVapidKey = (key: string): void => {
  localStorage.setItem(VAPID_KEY, key.trim());
};

/** Converte uma chave VAPID em base64url para Uint8Array. */
const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr: Uint8Array<ArrayBuffer> = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

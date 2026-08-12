/* Utilitários de notificações push e lembretes agendados. */

const REMINDER_OFFSET_KEY = 'familiapp:reminder-offset';
const VAPID_KEY = 'familiapp:vapid-key';
const SUBSCRIPTION_KEY = 'familiapp:push-subscription';

export type ReminderOffset = 0 | 15 | 60 | 1440; // minutos antes (0 = desligado)

export const REMINDER_OPTIONS: { value: ReminderOffset; label: string }[] = [
  { value: 0, label: 'Desligado' },
  { value: 15, label: '15 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];

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

export const getReminderOffset = (): ReminderOffset => {
  const n = Number(localStorage.getItem(REMINDER_OFFSET_KEY) ?? '0');
  return REMINDER_OPTIONS.some((o) => o.value === n) ? (n as ReminderOffset) : 0;
};

export const setReminderOffset = (value: ReminderOffset): void => {
  localStorage.setItem(REMINDER_OFFSET_KEY, String(value));
};

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
 * Calcula os lembretes desejados a partir dos eventos e envia ao service worker,
 * que agenda via Notification Triggers (disparam mesmo com o app fechado).
 * Deve ser chamado sempre que os eventos mudarem.
 */
export const scheduleEventReminders = async (events: ReminderEventLike[]): Promise<void> => {
  const offset = getReminderOffset();
  const sw = await getServiceWorker();
  if (!sw || !sw.active) return;

  const specs: ReminderSpec[] = [];
  if (offset > 0) {
    const now = Date.now();
    const horizon = now + 30 * 24 * 60 * 60 * 1000; // próximos 30 dias
    for (const e of events) {
      const [h, m] = e.time.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const at =
        new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate(), h, m).getTime() -
        offset * 60 * 1000;
      if (at > now && at < horizon) {
        specs.push({
          id: `ev-${e.id}`,
          at,
          title: `Lembrete: ${e.title}`,
          body: `Começa às ${e.time} — FamíliaApp.`,
        });
      }
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

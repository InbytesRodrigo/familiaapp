/* FamíliaApp — Service Worker
 * - Instalável (PWA) e offline (cache de runtime stale-while-revalidate)
 * - Recebe Push real enviado por um servidor (Web Push)
 * - Agenda lembretes de compromissos que disparam mesmo com o app fechado
 *   (Notification Triggers, Chrome/Android)
 */
const CACHE_NAME = 'familiapp-v1';
/* Caminhos relativos: o app pode rodar na raiz ou em subpasta (ex.: GitHub Pages) */
const SHELL = ['./', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const ICON = './icons/icon-192.png';

const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

/* Lembretes agendados via Notification Triggers (id -> ativo) */
const scheduledReminders = new Map();

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Em desenvolvimento (localhost) não faz cache: deixa o HMR do Vite funcionar. */
self.addEventListener('fetch', (event) => {
  if (isDev) return;
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

/* Push real: mensagem enviada por um servidor (Web Push). */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'FamíliaApp', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'FamíliaApp';
  const options = {
    body: payload.body || 'Você tem uma novidade na agenda da família.',
    icon: ICON,
    badge: ICON,
    vibrate: [100, 50, 100],
    tag: payload.tag || 'familiapp-push',
    data: { url: payload.url || self.registration.scope, pushId: payload.id || '' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* Clicou na notificação: abre/foca o app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/* Mensagens enviadas pelo app (janela) */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const { type } = data;

  if (type === 'SYNC_REMINDERS') {
    syncReminders(Array.isArray(data.specs) ? data.specs : []);
    return;
  }

  if (type === 'TEST_NOTIFICATION') {
    self.registration.showNotification(data.title || 'FamíliaApp', {
      body: data.body || 'Notificações push funcionando!',
      icon: ICON,
      badge: ICON,
      tag: 'familiapp-test',
      data: { url: self.registration.scope },
    });
    return;
  }

  if (type === 'CHECK_SCHEDULED') {
    if (event.source && 'postMessage' in event.source) {
      event.source.postMessage({
        type: 'SCHEDULED_SUPPORTED',
        supported: typeof TimestampTrigger !== 'undefined',
      });
    }
    return;
  }

  if (type === 'TEST_SCHEDULED') {
    const at = Date.now() + 15000; // 15 segundos
    try {
      self.registration.showNotification('Lembrete agendado ⏰', {
        body: 'Este lembrete foi agendado agora e disparou sozinho. Funciona mesmo com o app fechado!',
        icon: ICON,
        badge: ICON,
        tag: 'familiapp-scheduled-test',
        data: { url: self.registration.scope },
        showTrigger: new TimestampTrigger(at),
      });
    } catch (err) {
      console.error('[SW] Teste agendado não suportado:', err);
    }
  }
});

/* Sincroniza a lista autoritativa de lembretes (enviada pelo app a cada mudança). */
function syncReminders(specs) {
  const next = new Set(specs.map((s) => s.id));

  // Cancela lembretes que saíram da lista
  for (const id of scheduledReminders.keys()) {
    if (!next.has(id)) {
      scheduledReminders.delete(id);
      self.registration
        .getNotifications({ tag: `rem-${id}` })
        .then((list) => list.forEach((n) => n.close()))
        .catch(() => {});
    }
  }

  if (typeof TimestampTrigger === 'undefined') return; // navegador sem suporte

  for (const spec of specs) {
    if (scheduledReminders.has(spec.id)) continue;
    scheduledReminders.set(spec.id, true);
    try {
      self.registration
        .showNotification(spec.title || 'FamíliaApp', {
          body: spec.body || '',
          icon: ICON,
          badge: ICON,
          tag: `rem-${spec.id}`,
          data: { url: self.registration.scope, reminderId: spec.id },
          showTrigger: new TimestampTrigger(spec.at),
        })
        .catch(() => scheduledReminders.delete(spec.id));
    } catch {
      scheduledReminders.delete(spec.id);
    }
  }
}

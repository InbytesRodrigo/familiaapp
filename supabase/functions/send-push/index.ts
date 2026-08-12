/**
 * FamíliaApp — Edge Function de Web Push.
 *
 * GET  -> devolve a chave pública VAPID (o app usa para assinar neste aparelho)
 * POST -> recebe { title, body, url, tag } e envia push para TODAS as
 *         assinaturas salvas na tabela push_subscriptions.
 *
 * Assim as notificações chegam mesmo com o app fechado ou com o PWA
 * instalado na tela inicial (Android e iPhone/iPad com iOS 16.4+).
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@familiaapp.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // GET: chave pública VAPID para o app assinar
  if (req.method === 'GET') {
    return Response.json(
      { publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '' },
      { headers: CORS_HEADERS },
    );
  }

  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Método não permitido' },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS_HEADERS });
  }

  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  const message = JSON.stringify({
    title: payload.title || 'FamíliaApp',
    body: payload.body || '',
    url: payload.url || '/',
    tag: payload.tag || 'familiapp-push',
  });

  const failed: string[] = [];
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
        message,
      );
      sent += 1;
    } catch {
      // Endpoint rejeitado pelo serviço de push (aparelho desinstalado etc.)
      failed.push(s.endpoint);
    }
  }

  // Remove assinaturas mortas para não tentar de novo nas próximas vezes
  if (failed.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', failed);
  }

  return Response.json(
    { sent, total: (subs ?? []).length },
    { headers: CORS_HEADERS },
  );
});

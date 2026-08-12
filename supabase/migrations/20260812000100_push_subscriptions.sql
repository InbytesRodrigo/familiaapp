-- FamíliaApp: assinaturas de Web Push por aparelho.
-- Cada dispositivo que ativa as notificações salva aqui sua assinatura;
-- a Edge Function "send-push" lê esta tabela e envia as mensagens.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  keys_auth text not null,
  keys_p256dh text not null,
  criado_em timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- O app (chave anon) precisa inserir/remover a própria assinatura.
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert with check (true);

create policy "push_subscriptions_select" on public.push_subscriptions
  for select using (true);

create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete using (true);

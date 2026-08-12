-- FamíliaApp — Avisos entre membros + lembretes agendados no servidor
-- (o cron verifica a cada minuto e dispara push nos horários configurados)

-- ─── 1. Avisos (mensagens entre membros, com lido/não lido) ───
create table if not exists public.avisos (
  id uuid primary key,
  titulo text not null,
  mensagem text not null,
  de_id text not null,
  para_id text not null default 'all',
  tipo text not null default 'aviso',
  ref_id text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.avisos enable row level security;

create policy "avisos_insert" on public.avisos for insert with check (true);
create policy "avisos_select" on public.avisos for select using (true);
create policy "avisos_update" on public.avisos for update using (true);
create policy "avisos_delete" on public.avisos for delete using (true);

-- Entrega instantânea dos avisos entre aparelhos (Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.avisos;
  end if;
exception when others then
  null;
end $$;

-- ─── 2. Configurações do app (ex.: métodos de lembrete do push) ───
create table if not exists public.configuracao (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.configuracao enable row level security;

create policy "configuracao_insert" on public.configuracao for insert with check (true);
create policy "configuracao_select" on public.configuracao for select using (true);
create policy "configuracao_update" on public.configuracao for update using (true);

-- ─── 3. Mercado: data opcional (item que precisa para uma data específica) ───
alter table public.mercado add column if not exists data date;

-- ─── 4. Controle de lembretes já enviados (evita duplicar a cada minuto) ───
create table if not exists public.lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  ref_id text not null,
  minutos_antes int not null,
  criado_em timestamptz not null default now(),
  unique (ref_id, minutos_antes)
);

-- ─── 5. Extensões e cron do servidor ───
create extension if not exists pg_cron;
create extension if not exists pg_net;

grant execute on function net.http_post to anon, authenticated, service_role;

-- Função que verifica, a cada minuto, os compromissos e o mercado com data,
-- e manda o push via Edge Function nos horários configurados em "configuracao"
-- (chave 'lembretes' → [{"minutosAntes": 1440}, {"minutosAntes": 60}, ...]).
create or replace function public.disparar_lembretes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
  m jsonb;
  r record;
  inicio timestamptz;
  url text := 'https://ooaiukewoejaipydmkge.supabase.co/functions/v1/send-push';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYWl1a2V3b2VqYWlweWRta2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzU0OTIsImV4cCI6MjEwMTYxMTQ5Mn0.rNQantXXcOSvqLGqCAlAQ5MeBzBX_EopFv30vfNuYto';
begin
  select valor into cfg from public.configuracao where chave = 'lembretes';
  if cfg is null or jsonb_typeof(cfg) <> 'array' then
    cfg := '[{"minutosAntes":1440},{"minutosAntes":60},{"minutosAntes":15}]';
  end if;

  -- Lembretes de compromissos
  for r in
    select c.id::text as ref_id, c.titulo, c.hora,
           (c.data::text || ' ' || c.hora)::timestamp as inicio
    from public.compromissos c
    where (c.data::text || ' ' || c.hora)::timestamp >= now() - interval '2 hours'
  loop
    inicio := r.inicio;
    for m in select * from jsonb_array_elements(cfg)
    loop
      declare
        mins int := (m->>'minutosAntes')::int;
      begin
        if inicio - make_interval(mins => mins) <= now()
           and not exists (
             select 1 from public.lembretes_enviados
             where ref_id = r.ref_id and minutos_antes = mins
           )
        then
          insert into public.lembretes_enviados (ref_id, minutos_antes)
          values (r.ref_id, mins);

          perform net.http_post(
            url,
            jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || anon,
              'apikey', anon
            ),
            jsonb_build_object(
              'title', 'Lembrete: ' || r.titulo,
              'body', 'Começa às ' || r.hora || ' — FamíliaApp.',
              'url', '/',
              'tag', 'rem-' || r.ref_id || '-' || mins
            )
          );
        end if;
      end;
    end loop;
  end loop;

  -- Lembretes do mercado: item com data = hoje
  for r in
    select i.id::text as ref_id, i.nome
    from public.mercado i
    where i.data = current_date and not coalesce(i.comprado, false)
  loop
    if not exists (
      select 1 from public.lembretes_enviados
      where ref_id = r.ref_id and minutos_antes = 0
    ) then
      insert into public.lembretes_enviados (ref_id, minutos_antes)
      values (r.ref_id, 0);

      perform net.http_post(
        url,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon,
          'apikey', anon
        ),
        jsonb_build_object(
          'title', 'Lembrete de mercado',
          'body', 'Hoje: "' || r.nome || '" está na lista de compras.',
          'url', '/',
          'tag', 'rem-mercado-' || r.ref_id
        )
      );
    end if;
  end loop;
end $$;

-- Agenda o cron para rodar a cada minuto (substitui se já existir)
select cron.unschedule('familiapp-lembrete')
where exists (select 1 from cron.job where jobname = 'familiapp-lembrete');

select cron.schedule(
  'familiapp-lembrete',
  '* * * * *',
  $$ select public.disparar_lembretes() $$
);

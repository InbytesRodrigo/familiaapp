-- FamíliaApp — Presença online/offline.
-- Quando alguém abre o app, o aparelho grava aqui (com heartbeat); quem
-- está com o app aberto aparece "online" para o resto da família.
create table if not exists public.presenca (
  membro_id uuid primary key references public.familia(id) on delete cascade,
  online boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.presenca enable row level security;

create policy "presenca_insert" on public.presenca for insert with check (true);
create policy "presenca_select" on public.presenca for select using (true);
create policy "presenca_update" on public.presenca for update using (true);
create policy "presenca_delete" on public.presenca for delete using (true);

-- Entrega instantânea da presença entre aparelhos (Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.presenca;
  end if;
exception when others then
  null;
end $$;

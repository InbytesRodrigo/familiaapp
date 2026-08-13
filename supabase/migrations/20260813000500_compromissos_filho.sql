-- FamíliaApp — Compromissos do Filho.
-- Lista de compromissos com data, alerta até visualizar e data de conclusão.
create table if not exists public.compromissos_filho (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data_compromisso date,           -- data do compromisso
  concluido boolean not null default false,
  data_conclusao date,             -- data em que foi concluído
  alertar boolean not null default false, -- alerta o parceiro até visualizar
  criado_em timestamptz not null default now()
);

alter table public.compromissos_filho enable row level security;

create policy "filho_insert" on public.compromissos_filho for insert with check (true);
create policy "filho_select" on public.compromissos_filho for select using (true);
create policy "filho_update" on public.compromissos_filho for update using (true);
create policy "filho_delete" on public.compromissos_filho for delete using (true);

-- Entrega instantânea entre aparelhos (Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.compromissos_filho;
  end if;
exception when others then
  null;
end $$;

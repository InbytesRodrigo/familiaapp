-- FamíliaApp — Gastos compartilhados.
-- Registro de gastos com valor, parcelas, método de pagamento e status quitado.
-- As parcelas viram compromissos no calendário via coluna compromissos.gasto_id.

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  valor numeric(12,2) not null default 0,
  data date not null,             -- data da compra (base das datas das parcelas)
  parcelas integer not null default 1,  -- 1 = à vista
  metodo text not null default 'Pix',
  observacao text,                -- descrição/observação
  quitado boolean not null default false,
  criado_por uuid references public.familia(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Vincula os compromissos de parcela criados automaticamente ao gasto
alter table public.compromissos
  add column if not exists gasto_id uuid;

create index if not exists idx_compromissos_gasto on public.compromissos (gasto_id);

alter table public.gastos enable row level security;

create policy "gastos_insert" on public.gastos for insert with check (true);
create policy "gastos_select" on public.gastos for select using (true);
create policy "gastos_update" on public.gastos for update using (true);
create policy "gastos_delete" on public.gastos for delete using (true);

-- Entrega instantânea entre aparelhos (Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.gastos;
  end if;
exception when others then
  null;
end $$;

-- ============================================================
-- FamíliaApp — Schema do Supabase
-- Cole este SQL no Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- Membros da família
create table if not exists public.familia (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  papel text,
  cor text not null default '#a855f7',
  avatar text not null default '👤',
  criado_em timestamptz not null default now()
);

-- Compromissos
create table if not exists public.compromissos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date not null,
  hora time not null,
  hora_fim time,
  membro_id uuid references public.familia(id) on delete cascade,
  criado_por uuid references public.familia(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Lista de mercado
create table if not exists public.mercado (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  quantidade integer not null default 1,
  preco numeric(10,2) not null default 0,
  comprado boolean not null default false,
  membro_id uuid references public.familia(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Índices úteis
create index if not exists idx_compromissos_data on public.compromissos (data);
create index if not exists idx_compromissos_membro on public.compromissos (membro_id);
create index if not exists idx_mercado_comprado on public.mercado (comprado);

-- ============================================================
-- Segurança (RLS)
-- Modo atual: sem login — a chave anon pode ler/escrever.
-- ⚠️ Se depois ativar o Supabase Auth, troque as políticas por
--    "using (auth.uid() is not null)" ou por membro autenticado.
-- ============================================================
alter table public.familia enable row level security;
alter table public.compromissos enable row level security;
alter table public.mercado enable row level security;

create policy "familia_leitura" on public.familia for select using (true);
create policy "familia_insercao" on public.familia for insert with check (true);
create policy "familia_atualizacao" on public.familia for update using (true);
create policy "familia_exclusao" on public.familia for delete using (true);

create policy "compromissos_leitura" on public.compromissos for select using (true);
create policy "compromissos_insercao" on public.compromissos for insert with check (true);
create policy "compromissos_atualizacao" on public.compromissos for update using (true);
create policy "compromissos_exclusao" on public.compromissos for delete using (true);

create policy "mercado_leitura" on public.mercado for select using (true);
create policy "mercado_insercao" on public.mercado for insert with check (true);
create policy "mercado_atualizacao" on public.mercado for update using (true);
create policy "mercado_exclusao" on public.mercado for delete using (true);

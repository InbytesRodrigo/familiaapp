-- FamíliaApp — Data em que cada compra foi concluída.
-- Ao marcar o item como comprado, o app grava a data aqui; o relatório
-- mensal do mercado usa esta data (fallback: criado_em para itens antigos).
alter table public.mercado add column if not exists comprado_em date;

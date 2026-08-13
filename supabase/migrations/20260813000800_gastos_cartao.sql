-- FamíliaApp — Nome do cartão nos gastos.
-- Permite diferenciar cartões usados no pagamento (ex.: Nubank, Itaú).
alter table public.gastos
  add column if not exists cartao text;

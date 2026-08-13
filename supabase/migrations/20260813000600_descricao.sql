-- FamíliaApp — Descrição nos compromissos.
-- Campo opcional para explicações adicionais (além do título curto).
alter table public.compromissos
  add column if not exists descricao text;

alter table public.compromissos_filho
  add column if not exists descricao text;

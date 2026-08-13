-- FamíliaApp — Concluir compromisso na Agenda.
-- Botão de concluir no compromisso: registra a data de conclusão.

alter table public.compromissos
  add column if not exists concluido boolean not null default false,
  add column if not exists data_conclusao date;

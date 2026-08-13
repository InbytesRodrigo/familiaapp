-- FamíliaApp — "Alertar o parceiro" em compromissos.
-- Compromisso marcado como importante fica notificando (push periódico)
-- até o parceiro visualizar o compromisso.
alter table public.compromissos add column if not exists alertar boolean not null default false;

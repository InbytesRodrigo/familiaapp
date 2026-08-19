alter table public.compromissos_filho
  add column if not exists concluido_em timestamptz;

-- Registros antigos concluídos não devem reaparecer no novo histórico de 24 horas.
update public.compromissos_filho
set concluido_em = data_conclusao::timestamptz
where concluido = true and concluido_em is null and data_conclusao is not null;

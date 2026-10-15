-- Auditoria: paginação eficiente e retenção de 90 dias.
-- Regra de retenção: o log permanece durante todo o 90º dia e só é
-- removido a partir do dia seguinte, considerando o fuso America/Bahia.

CREATE INDEX IF NOT EXISTS auditoria_criado_em_idx
  ON public.auditoria (criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_usuario_criado_idx
  ON public.auditoria (usuario_nome, criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_modulo_criado_idx
  ON public.auditoria (modulo, criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_acao_criado_idx
  ON public.auditoria (acao, criado_em DESC);

CREATE OR REPLACE FUNCTION public.limpar_auditoria_expirada()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  apagados bigint;
  corte timestamptz;
BEGIN
  -- À meia-noite local do dia de corte. Exemplo:
  -- em 16/10, apaga tudo anterior a 18/07 00:00;
  -- portanto os logs de 17/07, que completaram 90 dias em 15/10,
  -- são removidos somente no dia 16/10.
  corte := (
    (((now() AT TIME ZONE 'America/Bahia')::date - 90)::timestamp)
    AT TIME ZONE 'America/Bahia'
  );

  DELETE FROM public.auditoria
  WHERE criado_em < corte;

  GET DIAGNOSTICS apagados = ROW_COUNT;
  RETURN apagados;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_auditoria_expirada() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.limpar_auditoria_expirada() FROM anon;
REVOKE ALL ON FUNCTION public.limpar_auditoria_expirada() FROM authenticated;

-- Agendamento diário às 03:10 UTC = 00:10 em Bahia (UTC-3).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'limpeza-auditoria-90-dias'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'limpeza-auditoria-90-dias',
  '10 3 * * *',
  'SELECT public.limpar_auditoria_expirada();'
);

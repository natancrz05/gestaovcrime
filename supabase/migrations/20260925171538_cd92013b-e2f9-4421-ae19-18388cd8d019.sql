ALTER TABLE public.audiencias ADD COLUMN IF NOT EXISTS data_realizacao date;
ALTER TABLE public.audiencias ALTER COLUMN situacao SET DEFAULT 'Agendada';

CREATE OR REPLACE FUNCTION public.confirmar_audiencia(p_id uuid, p_data date, p_obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a audiencias;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para confirmar audiência'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data da realização'; END IF;
  SELECT * INTO a FROM audiencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Audiência não encontrada'; END IF;
  IF a.situacao = 'Realizada' THEN RAISE EXCEPTION 'Audiência já confirmada como realizada'; END IF;
  UPDATE audiencias SET situacao = 'Realizada', data_realizacao = p_data,
    observacao = CASE WHEN coalesce(trim(p_obs),'') = '' THEN observacao
                      WHEN observacao = '' THEN left(p_obs, 1000)
                      ELSE observacao || E'\n' || left(p_obs, 1000) END
  WHERE id = p_id;
  IF NOT EXISTS (SELECT 1 FROM movimentacoes WHERE id_externo = 'audiencia:' || p_id) THEN
    INSERT INTO movimentacoes (processo_id, data, descricao, tipo, observacao, origem, id_externo)
    VALUES (a.processo_id, p_data, 'Audiência realizada', 'Audiência', left(coalesce(p_obs,''),1000), 'manual', 'audiencia:' || p_id);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.confirmar_audiencia(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_audiencia(uuid, date, text) TO authenticated;
CREATE TABLE public.reu_reavaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reu_id uuid NOT NULL REFERENCES public.reus(id) ON DELETE CASCADE,
  data_reavaliacao date NOT NULL,
  proxima_data date,
  observacao text NOT NULL DEFAULT '',
  usuario_nome text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reu_reavaliacoes TO authenticated;
GRANT ALL ON public.reu_reavaliacoes TO service_role;
ALTER TABLE public.reu_reavaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ativos veem reavaliacoes" ON public.reu_reavaliacoes FOR SELECT TO authenticated USING (public.usuario_ativo(auth.uid()));

CREATE OR REPLACE FUNCTION public.registrar_reavaliacao(p_reu uuid, p_data date, p_proxima date, p_obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r reus; uname text := public.auditoria_nome(auth.uid()); num text; ant text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para registrar reavaliação'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data da reavaliação'; END IF;
  SELECT * INTO r FROM reus WHERE id = p_reu FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Réu não encontrado'; END IF;
  ant := r.dados_planilha->>'Última reavaliação';
  IF ant IS NOT NULL AND ant <> '' AND NOT EXISTS (SELECT 1 FROM reu_reavaliacoes WHERE reu_id = p_reu AND data_reavaliacao::text = ant) THEN
    INSERT INTO reu_reavaliacoes (reu_id, data_reavaliacao, proxima_data, observacao, usuario_nome)
    VALUES (p_reu, ant::date, NULLIF(r.dados_planilha->>'Data de reavaliação','')::date, 'Reavaliação anterior (registrada antes do histórico)', '');
  END IF;
  INSERT INTO reu_reavaliacoes (reu_id, data_reavaliacao, proxima_data, observacao, usuario_nome)
  VALUES (p_reu, p_data, p_proxima, left(coalesce(p_obs,''),1000), uname);
  UPDATE reus SET dados_planilha = (coalesce(dados_planilha,'{}'::jsonb) - 'Data de reavaliação')
    || jsonb_build_object('Última reavaliação', p_data::text)
    || CASE WHEN p_proxima IS NOT NULL THEN jsonb_build_object('Data de reavaliação', p_proxima::text) ELSE '{}'::jsonb END
  WHERE id = p_reu;
  SELECT numero INTO num FROM processos WHERE id = r.processo_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), uname, 'Editado', 'Réus', p_reu, r.processo_id, coalesce(num,''),
    'Reavaliação da prisão de ' || r.nome || ' registrada em ' || to_char(p_data,'DD/MM/YYYY'));
END $$;
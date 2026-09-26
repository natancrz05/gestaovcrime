CREATE TABLE public.reu_prisoes_encerradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reu_id uuid NOT NULL REFERENCES public.reus(id) ON DELETE CASCADE,
  processo_id uuid,
  tipo_prisao text NOT NULL DEFAULT '',
  especie_cautelar text NOT NULL DEFAULT '',
  data_prisao date,
  data_encerramento date NOT NULL,
  motivo text NOT NULL DEFAULT '',
  situacao_anterior text NOT NULL DEFAULT '',
  dados_planilha jsonb NOT NULL DEFAULT '{}',
  usuario_nome text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reu_prisoes_encerradas TO authenticated;
GRANT ALL ON public.reu_prisoes_encerradas TO service_role;
ALTER TABLE public.reu_prisoes_encerradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ativos visualizam historico de prisoes" ON public.reu_prisoes_encerradas FOR SELECT TO authenticated USING (public.usuario_ativo(auth.uid()));

CREATE OR REPLACE FUNCTION public.encerrar_prisao(p_reu uuid, p_data date, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r reus; uname text := public.auditoria_nome(auth.uid()); num text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para encerrar situação prisional'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data do encerramento'; END IF;
  SELECT * INTO r FROM reus WHERE id = p_reu FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Réu não encontrado'; END IF;
  IF NOT r.preso THEN RAISE EXCEPTION 'O réu não está registrado como preso'; END IF;
  INSERT INTO reu_prisoes_encerradas (reu_id, processo_id, tipo_prisao, especie_cautelar, data_prisao, data_encerramento, motivo, situacao_anterior, dados_planilha, usuario_nome)
  VALUES (r.id, r.processo_id, r.tipo_prisao, r.especie_cautelar, r.data_prisao, p_data, left(coalesce(p_motivo,''),1000), r.situacao, r.dados_planilha, uname);
  UPDATE reus SET preso = false, tipo_prisao = 'Não preso', situacao = 'Prisão encerrada em ' || to_char(p_data,'DD/MM/YYYY') WHERE id = p_reu;
  SELECT numero INTO num FROM processos WHERE id = r.processo_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), uname, 'Alteração de status', 'Réus', r.id, r.processo_id, coalesce(num,''),
    'Situação prisional de ' || r.nome || ' encerrada em ' || to_char(p_data,'DD/MM/YYYY') || ' (' || r.tipo_prisao || ')' || CASE WHEN coalesce(trim(p_motivo),'') <> '' THEN ': ' || left(p_motivo,300) ELSE '' END);
END $$;
REVOKE EXECUTE ON FUNCTION public.encerrar_prisao(uuid,date,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.encerrar_prisao(uuid,date,text) TO authenticated;
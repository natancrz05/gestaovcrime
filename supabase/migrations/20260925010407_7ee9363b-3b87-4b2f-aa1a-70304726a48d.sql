ALTER TABLE public.comparecimentos DROP CONSTRAINT IF EXISTS comparecimentos_periodicidade_check;
ALTER TABLE public.comparecimentos ADD COLUMN intervalo_meses integer NOT NULL DEFAULT 1 CHECK (intervalo_meses BETWEEN 1 AND 120);
ALTER TABLE public.comparecimentos ADD CONSTRAINT comparecimentos_periodicidade_check CHECK (periodicidade IN ('Mensal','Bimestral','Trimestral','Quadrimestral','Semestral','Anual','Personalizado'));

CREATE OR REPLACE FUNCTION public.registrar_comparecimento(p_id uuid, p_data date, p_obs text)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c comparecimentos; novo date; uname text := public.auditoria_nome(auth.uid()); num text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para registrar comparecimento'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data do comparecimento'; END IF;
  SELECT * INTO c FROM comparecimentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comparecimento não encontrado'; END IF;
  novo := (p_data + make_interval(months => c.intervalo_meses))::date;
  INSERT INTO comparecimento_registros (comparecimento_id, processo_id, data_prevista, data_realizada, situacao, observacao)
  VALUES (c.id, c.processo_id, c.proximo, p_data, CASE WHEN p_data > c.proximo THEN 'Realizado com atraso' ELSE 'Realizado' END, left(coalesce(p_obs,''), 1000));
  UPDATE comparecimentos SET proximo = novo WHERE id = c.id;
  SELECT numero INTO num FROM processos WHERE id = c.processo_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), uname, 'Concluído', 'Comparecimentos', c.id, c.processo_id, coalesce(num,''),
    'Comparecimento de ' || c.pessoa || ' registrado em ' || to_char(p_data,'DD/MM/YYYY') || '; próximo: ' || to_char(novo,'DD/MM/YYYY'));
  RETURN novo;
END $$;
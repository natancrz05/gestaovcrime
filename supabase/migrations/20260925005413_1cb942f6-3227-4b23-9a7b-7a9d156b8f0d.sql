CREATE TABLE public.comparecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  pessoa text NOT NULL,
  data_inicio date NOT NULL,
  periodicidade text NOT NULL DEFAULT 'Mensal' CHECK (periodicidade = 'Mensal'),
  proximo date NOT NULL,
  observacao text NOT NULL DEFAULT '',
  situacao text NOT NULL DEFAULT 'Ativo' CHECK (situacao IN ('Ativo','Encerrado')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.comparecimentos TO authenticated;
GRANT ALL ON public.comparecimentos TO service_role;
ALTER TABLE public.comparecimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura por usuarios ativos" ON public.comparecimentos FOR SELECT TO authenticated USING (public.usuario_ativo(auth.uid()));
CREATE POLICY "cadastro por admin ou servidor" ON public.comparecimentos FOR INSERT TO authenticated WITH CHECK (public.pode_editar(auth.uid()));
CREATE POLICY "edicao por admin ou servidor" ON public.comparecimentos FOR UPDATE TO authenticated USING (public.pode_editar(auth.uid())) WITH CHECK (public.pode_editar(auth.uid()));

CREATE TABLE public.comparecimento_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparecimento_id uuid NOT NULL REFERENCES public.comparecimentos(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_prevista date NOT NULL,
  data_realizada date NOT NULL,
  situacao text NOT NULL,
  observacao text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comparecimento_registros TO authenticated;
GRANT ALL ON public.comparecimento_registros TO service_role;
ALTER TABLE public.comparecimento_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura por usuarios ativos" ON public.comparecimento_registros FOR SELECT TO authenticated USING (public.usuario_ativo(auth.uid()));

CREATE OR REPLACE FUNCTION public.registrar_comparecimento(p_id uuid, p_data date, p_obs text)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c comparecimentos; novo date; uname text := public.auditoria_nome(auth.uid()); num text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para registrar comparecimento'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data do comparecimento'; END IF;
  SELECT * INTO c FROM comparecimentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comparecimento não encontrado'; END IF;
  novo := (p_data + interval '1 month')::date;
  INSERT INTO comparecimento_registros (comparecimento_id, processo_id, data_prevista, data_realizada, situacao, observacao)
  VALUES (c.id, c.processo_id, c.proximo, p_data, CASE WHEN p_data > c.proximo THEN 'Realizado com atraso' ELSE 'Realizado' END, left(coalesce(p_obs,''), 1000));
  UPDATE comparecimentos SET proximo = novo WHERE id = c.id;
  SELECT numero INTO num FROM processos WHERE id = c.processo_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), uname, 'Concluído', 'Comparecimentos', c.id, c.processo_id, coalesce(num,''),
    'Comparecimento de ' || c.pessoa || ' registrado em ' || to_char(p_data,'DD/MM/YYYY') || '; próximo: ' || to_char(novo,'DD/MM/YYYY'));
  RETURN novo;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_comparecimento(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_comparecimento(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.auditoria_comparecimentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE num text; d text;
BEGIN
  SELECT numero INTO num FROM processos WHERE id = NEW.processo_id;
  IF TG_OP = 'INSERT' THEN d := 'Comparecimento mensal de ' || NEW.pessoa || ' cadastrado';
  ELSIF OLD.proximo IS DISTINCT FROM NEW.proximo AND OLD.pessoa = NEW.pessoa AND OLD.situacao = NEW.situacao AND OLD.observacao = NEW.observacao THEN RETURN NULL; -- já auditado pelo registro
  ELSIF OLD.situacao IS DISTINCT FROM NEW.situacao THEN d := 'Comparecimento de ' || NEW.pessoa || ': ' || OLD.situacao || ' → ' || NEW.situacao;
  ELSE d := 'Comparecimento de ' || NEW.pessoa || ' editado'; END IF;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), public.auditoria_nome(auth.uid()), CASE WHEN TG_OP='INSERT' THEN 'Criado' WHEN OLD.situacao IS DISTINCT FROM NEW.situacao THEN 'Alteração de status' ELSE 'Editado' END,
    'Comparecimentos', NEW.id, NEW.processo_id, coalesce(num,''), d);
  RETURN NULL;
END $$;
CREATE TRIGGER auditoria_comparecimentos AFTER INSERT OR UPDATE ON public.comparecimentos FOR EACH ROW EXECUTE FUNCTION public.auditoria_comparecimentos();
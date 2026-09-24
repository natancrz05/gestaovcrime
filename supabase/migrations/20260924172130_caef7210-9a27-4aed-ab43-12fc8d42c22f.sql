ALTER TABLE public.processos
  ADD COLUMN pje_classe_codigo text, ADD COLUMN pje_ultima_mov_data date, ADD COLUMN pje_ultima_mov_descricao text,
  ADD COLUMN pje_qtde_dias integer, ADD COLUMN pje_situacao text, ADD COLUMN pje_tarefas text, ADD COLUMN pje_autor text,
  ADD COLUMN pje_reu text, ADD COLUMN pje_prioridade text, ADD COLUMN pje_descricao_prioridade text, ADD COLUMN pje_concluso text,
  ADD COLUMN pje_segredo text, ADD COLUMN pje_localizacao text, ADD COLUMN pje_sistema text;

CREATE UNIQUE INDEX processos_numero_normalizado_uidx ON public.processos ((regexp_replace(numero, '\D', '', 'g')));

ALTER TABLE public.auditoria DROP CONSTRAINT IF EXISTS auditoria_acao_check;
ALTER TABLE public.auditoria ADD CONSTRAINT auditoria_acao_check CHECK (acao IN ('Criado','Editado','Excluído','Concluído','Alteração de status','Login','Logout','Login malsucedido','Importação','Importação desfeita'));

CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  analisados integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  sem_alteracao integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  conflitos integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Concluída',
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  desfeita_em timestamptz,
  desfeita_por text
);
GRANT SELECT ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou servidor leem importacoes" ON public.importacoes FOR SELECT TO authenticated USING (public.pode_editar(auth.uid()));

CREATE TABLE public.importacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.importacoes(id) ON DELETE CASCADE,
  processo_id uuid,
  numero text NOT NULL,
  linha integer,
  acao text NOT NULL CHECK (acao IN ('criado','atualizado')),
  antes jsonb NOT NULL DEFAULT '{}'::jsonb,
  depois jsonb NOT NULL DEFAULT '{}'::jsonb,
  movimentacao_id uuid,
  reus_ids uuid[] NOT NULL DEFAULT '{}',
  desfeito text
);
CREATE INDEX importacao_itens_imp_idx ON public.importacao_itens (importacao_id);
GRANT SELECT ON public.importacao_itens TO authenticated;
GRANT ALL ON public.importacao_itens TO service_role;
ALTER TABLE public.importacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou servidor leem itens" ON public.importacao_itens FOR SELECT TO authenticated USING (public.pode_editar(auth.uid()));

CREATE OR REPLACE FUNCTION public.importar_processos(p_arquivo text, p_linhas jsonb, p_erros jsonb, p_ignorados jsonb, p_aplicar_conflitos boolean, p_simular boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  campos text[] := ARRAY['classe','assunto','data_distribuicao','pje_classe_codigo','pje_ultima_mov_data','pje_ultima_mov_descricao','pje_qtde_dias','pje_situacao','pje_tarefas','pje_autor','pje_reu','pje_prioridade','pje_descricao_prioridade','pje_concluso','pje_segredo','pje_localizacao','pje_sistema'];
  mov_campos text[] := ARRAY['pje_ultima_mov_data','pje_ultima_mov_descricao','pje_qtde_dias'];
  l jsonb; c jsonb; atual jsonb; p public.processos; v_id uuid; v_imp uuid; v_num int;
  f text; novo text; velho text; antes jsonb; depois jsonb; mudancas jsonb; confl jsonb; ref_data date;
  tem_conflito boolean; pula_mov boolean; v_mov uuid; v_reus uuid[]; nome text; merged jsonb; descr text;
  r_novos jsonb := '[]'; r_atual jsonb := '[]'; r_confl jsonb := '[]'; n_sem int := 0; n_proc int := 0;
  uname text := public.auditoria_nome(auth.uid()); status_final text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para importar processos'; END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN RAISE EXCEPTION 'Estrutura inválida'; END IF;
  IF (SELECT count(*) <> count(DISTINCT regexp_replace(x->>'numero','\D','','g')) FROM jsonb_array_elements(p_linhas) x) THEN
    RAISE EXCEPTION 'A planilha contém processos duplicados; nada foi alterado';
  END IF;

  IF NOT p_simular THEN
    INSERT INTO importacoes (usuario_id, usuario_nome, arquivo) VALUES (auth.uid(), uname, left(p_arquivo, 255)) RETURNING id, numero INTO v_imp, v_num;
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    n_proc := n_proc + 1;
    c := COALESCE(l->'campos', '{}'::jsonb);
    SELECT * INTO p FROM processos WHERE regexp_replace(numero,'\D','','g') = regexp_replace(l->>'numero','\D','','g');

    IF NOT FOUND THEN
      r_novos := r_novos || jsonb_build_object('numero', l->>'numero', 'linha', l->'linha', 'classe', c->>'classe', 'reu', c->>'pje_reu');
      IF NOT p_simular THEN
        merged := jsonb_build_object('numero', l->>'numero', 'classe', COALESCE(NULLIF(c->>'classe',''), 'Não informada'), 'origem', 'pje_tjba') || (c - 'classe');
        INSERT INTO processos (numero, classe, origem, assunto, data_distribuicao, pje_classe_codigo, pje_ultima_mov_data, pje_ultima_mov_descricao, pje_qtde_dias, pje_situacao, pje_tarefas, pje_autor, pje_reu, pje_prioridade, pje_descricao_prioridade, pje_concluso, pje_segredo, pje_localizacao, pje_sistema)
        SELECT r.numero, r.classe, r.origem, COALESCE(r.assunto,''), r.data_distribuicao, r.pje_classe_codigo, r.pje_ultima_mov_data, r.pje_ultima_mov_descricao, r.pje_qtde_dias, r.pje_situacao, r.pje_tarefas, r.pje_autor, r.pje_reu, r.pje_prioridade, r.pje_descricao_prioridade, r.pje_concluso, r.pje_segredo, r.pje_localizacao, r.pje_sistema
        FROM jsonb_populate_record(NULL::processos, merged) r RETURNING id INTO v_id;
        v_reus := '{}'; v_mov := NULL;
        IF NULLIF(trim(c->>'pje_reu'),'') IS NOT NULL THEN
          FOR nome IN SELECT trim(x) FROM regexp_split_to_table(c->>'pje_reu', '\s*[;\n]\s*') x WHERE trim(x) <> '' LOOP
            INSERT INTO reus (processo_id, nome, ordem) VALUES (v_id, nome, COALESCE(array_length(v_reus,1),0)) RETURNING id INTO v_mov;
            v_reus := v_reus || v_mov;
          END LOOP;
          v_mov := NULL;
        END IF;
        IF c ? 'pje_ultima_mov_data' AND NULLIF(c->>'pje_ultima_mov_descricao','') IS NOT NULL THEN
          INSERT INTO movimentacoes (processo_id, data, descricao, origem, id_externo)
          VALUES (v_id, (c->>'pje_ultima_mov_data')::date, c->>'pje_ultima_mov_descricao', 'pje', 'importacao:' || v_imp) RETURNING id INTO v_mov;
        END IF;
        INSERT INTO importacao_itens (importacao_id, processo_id, numero, linha, acao, depois, movimentacao_id, reus_ids)
        VALUES (v_imp, v_id, l->>'numero', (l->>'linha')::int, 'criado', merged, v_mov, v_reus);
        INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
        VALUES (auth.uid(), uname, 'Importação', 'Importação', v_imp, v_id, l->>'numero', 'Processo criado pela Importação #' || v_num || ' (' || left(p_arquivo, 80) || ')');
      END IF;
      CONTINUE;
    END IF;

    atual := to_jsonb(p);
    SELECT max(data) INTO ref_data FROM movimentacoes WHERE processo_id = p.id;
    ref_data := GREATEST(ref_data, p.pje_ultima_mov_data);
    tem_conflito := false; pula_mov := false; confl := '[]';
    IF c ? 'pje_ultima_mov_data' AND ref_data IS NOT NULL AND (c->>'pje_ultima_mov_data')::date < ref_data THEN
      tem_conflito := true;
      confl := confl || jsonb_build_object('numero', p.numero, 'campo', 'pje_ultima_mov_data', 'atual', ref_data, 'novo', c->>'pje_ultima_mov_data',
        'motivo', 'A data da última movimentação na planilha é anterior à registrada no sistema');
      pula_mov := NOT p_aplicar_conflitos;
    END IF;
    IF c ? 'data_distribuicao' AND p.data_distribuicao IS NOT NULL AND p.data_distribuicao::text <> c->>'data_distribuicao' THEN
      tem_conflito := true;
      confl := confl || jsonb_build_object('numero', p.numero, 'campo', 'data_distribuicao', 'atual', p.data_distribuicao, 'novo', c->>'data_distribuicao',
        'motivo', 'Data de autuação diferente da cadastrada');
    END IF;
    r_confl := r_confl || confl;

    antes := '{}'; depois := '{}'; mudancas := '[]';
    FOREACH f IN ARRAY campos LOOP
      CONTINUE WHEN NOT (c ? f) OR NULLIF(trim(c->>f),'') IS NULL;
      CONTINUE WHEN pula_mov AND f = ANY(mov_campos);
      CONTINUE WHEN f = 'data_distribuicao' AND p.data_distribuicao IS NOT NULL AND NOT p_aplicar_conflitos;
      novo := c->>f; velho := atual->>f;
      IF velho IS DISTINCT FROM novo THEN
        antes := antes || jsonb_build_object(f, atual->f);
        depois := depois || jsonb_build_object(f, c->f);
        mudancas := mudancas || jsonb_build_object('campo', f, 'antes', velho, 'depois', novo);
      END IF;
    END LOOP;

    IF depois = '{}'::jsonb THEN n_sem := n_sem + 1; CONTINUE; END IF;
    r_atual := r_atual || jsonb_build_object('numero', p.numero, 'linha', l->'linha', 'mudancas', mudancas, 'conflito', tem_conflito);

    IF NOT p_simular THEN
      merged := atual || depois;
      UPDATE processos t SET classe = r.classe, assunto = r.assunto, data_distribuicao = r.data_distribuicao, pje_classe_codigo = r.pje_classe_codigo,
        pje_ultima_mov_data = r.pje_ultima_mov_data, pje_ultima_mov_descricao = r.pje_ultima_mov_descricao, pje_qtde_dias = r.pje_qtde_dias,
        pje_situacao = r.pje_situacao, pje_tarefas = r.pje_tarefas, pje_autor = r.pje_autor, pje_reu = r.pje_reu, pje_prioridade = r.pje_prioridade,
        pje_descricao_prioridade = r.pje_descricao_prioridade, pje_concluso = r.pje_concluso, pje_segredo = r.pje_segredo,
        pje_localizacao = r.pje_localizacao, pje_sistema = r.pje_sistema
      FROM jsonb_populate_record(NULL::processos, merged) r WHERE t.id = p.id;
      v_mov := NULL;
      IF NOT pula_mov AND depois ? 'pje_ultima_mov_data' AND NULLIF(c->>'pje_ultima_mov_descricao','') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM movimentacoes m WHERE m.processo_id = p.id AND m.data = (c->>'pje_ultima_mov_data')::date AND m.descricao = c->>'pje_ultima_mov_descricao') THEN
        INSERT INTO movimentacoes (processo_id, data, descricao, origem, id_externo)
        VALUES (p.id, (c->>'pje_ultima_mov_data')::date, c->>'pje_ultima_mov_descricao', 'pje', 'importacao:' || v_imp) RETURNING id INTO v_mov;
      END IF;
      INSERT INTO importacao_itens (importacao_id, processo_id, numero, linha, acao, antes, depois, movimentacao_id)
      VALUES (v_imp, p.id, p.numero, (l->>'linha')::int, 'atualizado', antes, depois, v_mov);
      SELECT string_agg(x->>'campo' || ': ' || COALESCE(x->>'antes','(vazio)') || ' → ' || (x->>'depois'), '; ') INTO descr FROM jsonb_array_elements(mudancas) x;
      INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
      VALUES (auth.uid(), uname, 'Importação', 'Importação', v_imp, p.id, p.numero, 'Importação #' || v_num || ' — ' || left(descr, 1500));
    END IF;
  END LOOP;

  IF p_simular THEN
    RETURN jsonb_build_object('analisados', n_proc, 'novos', r_novos, 'atualizados', r_atual, 'sem_alteracao', n_sem, 'conflitos', r_confl);
  END IF;

  status_final := CASE WHEN jsonb_array_length(r_confl) > 0 OR jsonb_array_length(COALESCE(p_erros,'[]')) > 0 OR jsonb_array_length(COALESCE(p_ignorados,'[]')) > 0 THEN 'Concluída com alertas' ELSE 'Concluída' END;
  UPDATE importacoes SET analisados = n_proc + jsonb_array_length(COALESCE(p_erros,'[]')) + jsonb_array_length(COALESCE(p_ignorados,'[]')),
    novos = jsonb_array_length(r_novos), atualizados = jsonb_array_length(r_atual), sem_alteracao = n_sem,
    ignorados = jsonb_array_length(COALESCE(p_ignorados,'[]')), conflitos = jsonb_array_length(r_confl),
    erros = jsonb_array_length(COALESCE(p_erros,'[]')), status = status_final,
    detalhes = jsonb_build_object('erros', COALESCE(p_erros,'[]'), 'ignorados', COALESCE(p_ignorados,'[]'), 'conflitos', r_confl, 'conflitos_aplicados', p_aplicar_conflitos)
  WHERE id = v_imp;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, descricao)
  VALUES (auth.uid(), uname, 'Importação', 'Importação', v_imp, 'Importação #' || v_num || ' (' || left(p_arquivo,80) || '): ' || jsonb_array_length(r_novos) || ' novos, ' || jsonb_array_length(r_atual) || ' atualizados, ' || n_sem || ' sem alteração');
  RETURN jsonb_build_object('id', v_imp, 'numero', v_num, 'status', status_final);
END $$;
REVOKE EXECUTE ON FUNCTION public.importar_processos(text, jsonb, jsonb, jsonb, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_processos(text, jsonb, jsonb, jsonb, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.desfazer_importacao(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  imp importacoes; it importacao_itens; atual jsonb; restaurar jsonb; f text; r_rem int := 0; r_mant int := 0; r_rest int := 0; r_parc int := 0;
  uname text := public.auditoria_nome(auth.uid());
BEGIN
  IF NOT public.eh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o Administrador pode desfazer importações'; END IF;
  SELECT * INTO imp FROM importacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR imp.desfeita_em IS NOT NULL OR imp.status = 'Falhou' THEN RAISE EXCEPTION 'Importação não pode ser desfeita'; END IF;
  IF EXISTS (SELECT 1 FROM importacoes WHERE numero > imp.numero AND desfeita_em IS NULL AND status <> 'Falhou') THEN
    RAISE EXCEPTION 'Só é possível desfazer a última importação. Desfaça antes as importações mais recentes.';
  END IF;

  FOR it IN SELECT * FROM importacao_itens WHERE importacao_id = p_id LOOP
    IF it.movimentacao_id IS NOT NULL THEN DELETE FROM movimentacoes WHERE id = it.movimentacao_id AND id_externo = 'importacao:' || p_id; END IF;
    IF it.acao = 'criado' THEN
      IF EXISTS (SELECT 1 FROM audiencias WHERE processo_id = it.processo_id) OR EXISTS (SELECT 1 FROM pendencias WHERE processo_id = it.processo_id)
         OR EXISTS (SELECT 1 FROM prioridades WHERE processo_id = it.processo_id) OR EXISTS (SELECT 1 FROM observacoes_internas WHERE processo_id = it.processo_id)
         OR EXISTS (SELECT 1 FROM partes WHERE processo_id = it.processo_id)
         OR EXISTS (SELECT 1 FROM reus WHERE processo_id = it.processo_id AND NOT (id = ANY(it.reus_ids)))
         OR EXISTS (SELECT 1 FROM movimentacoes WHERE processo_id = it.processo_id) THEN
        UPDATE importacao_itens SET desfeito = 'mantido: possui dados cadastrados manualmente após a importação' WHERE id = it.id; r_mant := r_mant + 1;
      ELSE
        DELETE FROM processos WHERE id = it.processo_id; UPDATE importacao_itens SET desfeito = 'removido' WHERE id = it.id; r_rem := r_rem + 1;
      END IF;
    ELSE
      SELECT to_jsonb(p) INTO atual FROM processos p WHERE id = it.processo_id;
      IF atual IS NULL THEN UPDATE importacao_itens SET desfeito = 'processo não existe mais' WHERE id = it.id; CONTINUE; END IF;
      restaurar := '{}';
      FOR f IN SELECT jsonb_object_keys(it.depois) LOOP
        IF atual->>f IS NOT DISTINCT FROM it.depois->>f THEN restaurar := restaurar || jsonb_build_object(f, it.antes->f); END IF;
      END LOOP;
      IF restaurar <> '{}'::jsonb THEN
        atual := atual || restaurar;
        UPDATE processos t SET classe = r.classe, assunto = r.assunto, data_distribuicao = r.data_distribuicao, pje_classe_codigo = r.pje_classe_codigo,
          pje_ultima_mov_data = r.pje_ultima_mov_data, pje_ultima_mov_descricao = r.pje_ultima_mov_descricao, pje_qtde_dias = r.pje_qtde_dias,
          pje_situacao = r.pje_situacao, pje_tarefas = r.pje_tarefas, pje_autor = r.pje_autor, pje_reu = r.pje_reu, pje_prioridade = r.pje_prioridade,
          pje_descricao_prioridade = r.pje_descricao_prioridade, pje_concluso = r.pje_concluso, pje_segredo = r.pje_segredo,
          pje_localizacao = r.pje_localizacao, pje_sistema = r.pje_sistema
        FROM jsonb_populate_record(NULL::processos, atual) r WHERE t.id = it.processo_id;
      END IF;
      IF (SELECT count(*) FROM jsonb_object_keys(restaurar)) = (SELECT count(*) FROM jsonb_object_keys(it.depois)) THEN
        UPDATE importacao_itens SET desfeito = 'restaurado' WHERE id = it.id; r_rest := r_rest + 1;
      ELSE
        UPDATE importacao_itens SET desfeito = 'parcial: campos alterados depois da importação foram mantidos' WHERE id = it.id; r_parc := r_parc + 1;
      END IF;
      INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
      VALUES (auth.uid(), uname, 'Importação desfeita', 'Importação', p_id, it.processo_id, it.numero, 'Valores anteriores restaurados (Importação #' || imp.numero || ' desfeita)');
    END IF;
  END LOOP;

  UPDATE importacoes SET status = 'Desfeita', desfeita_em = now(), desfeita_por = uname,
    detalhes = detalhes || jsonb_build_object('desfazer', jsonb_build_object('removidos', r_rem, 'mantidos', r_mant, 'restaurados', r_rest, 'parciais', r_parc))
  WHERE id = p_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, descricao)
  VALUES (auth.uid(), uname, 'Importação desfeita', 'Importação', p_id, 'Importação #' || imp.numero || ' desfeita: ' || r_rem || ' removidos, ' || r_rest || ' restaurados, ' || r_parc || ' parciais, ' || r_mant || ' mantidos');
  RETURN jsonb_build_object('removidos', r_rem, 'mantidos', r_mant, 'restaurados', r_rest, 'parciais', r_parc);
END $$;
REVOKE EXECUTE ON FUNCTION public.desfazer_importacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_importacao(uuid) TO authenticated;
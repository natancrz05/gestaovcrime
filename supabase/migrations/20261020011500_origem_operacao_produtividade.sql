CREATE OR REPLACE FUNCTION public.importar_processos(p_arquivo text, p_linhas jsonb, p_erros jsonb, p_ignorados jsonb, p_aplicar_conflitos boolean, p_simular boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NOT p_simular THEN
    PERFORM set_config('app.origem_operacao', 'importacao', true);
  END IF;
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
          VALUES (v_id, (c->>'pje_ultima_mov_data')::date, c->>'pje_ultima_mov_descricao', 'pje_tjba', 'importacao:' || v_imp) RETURNING id INTO v_mov;
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
        VALUES (p.id, (c->>'pje_ultima_mov_data')::date, c->>'pje_ultima_mov_descricao', 'pje_tjba', 'importacao:' || v_imp) RETURNING id INTO v_mov;
      END IF;
      INSERT INTO importacao_itens (importacao_id, processo_id, numero, linha, acao, antes, depois, movimentacao_id)
      VALUES (v_imp, p.id, p.numero, (l->>'linha')::int, 'atualizado', antes, depois, v_mov);
      SELECT string_agg(public.rotulo_campo_importacao(x->>'campo') || ': ' || COALESCE(x->>'antes','(vazio)') || ' → ' || (x->>'depois'), '; ') INTO descr FROM jsonb_array_elements(mudancas) x;
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
END $function$;



CREATE OR REPLACE FUNCTION public.classificar_auditoria_produtividade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origem_processo text;
  v_observacao_audiencia text;
  v_dados_comparecimento jsonb;
  v_historico_oficio boolean;
  v_origem_movimentacao text;
BEGIN
  NEW.origem := 'indefinida';
  NEW.conta_produtividade := false;
  NEW.categoria_produtividade := '';

  IF NEW.modulo = 'Acesso' THEN
    NEW.origem := 'acesso'; RETURN NEW;
  END IF;

  IF NEW.modulo = 'Importação' OR NEW.acao IN ('Importação', 'Importação desfeita') THEN
    NEW.origem := 'importacao'; RETURN NEW;
  END IF;

  IF NEW.modulo IN ('Sistema', 'Problemas e Sugestões', 'Usuários') THEN
    NEW.origem := 'sistema'; RETURN NEW;
  END IF;

  IF NEW.modulo = 'Prioridades' THEN
    NEW.origem := 'organizacao'; RETURN NEW;
  END IF;

  IF current_setting('app.origem_operacao', true) = 'importacao' THEN
    NEW.origem := 'importacao';
    NEW.conta_produtividade := false;
    NEW.categoria_produtividade := '';
    RETURN NEW;
  END IF;

  IF COALESCE(NULLIF(NEW.usuario_nome, ''), 'Sistema') = 'Sistema'
     AND NEW.usuario_id IS NULL THEN
    NEW.origem := 'indefinida'; RETURN NEW;
  END IF;

  IF NEW.modulo = 'Processos' THEN
    NEW.origem := 'manual';
    IF NEW.acao = 'Criado' THEN
      SELECT origem INTO v_origem_processo FROM public.processos WHERE id = NEW.registro_id;
      IF COALESCE(v_origem_processo, 'manual') <> 'manual' THEN
        NEW.origem := 'importacao';
        RETURN NEW;
      END IF;
    END IF;
    IF NEW.acao IN ('Criado', 'Alteração de status') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Processos';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Audiências' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Audiências';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Comparecimentos' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Comparecimentos';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Pendências' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true; NEW.categoria_produtividade := 'Pendências';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Prisões' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true; NEW.categoria_produtividade := 'Prisões';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Ofícios' THEN
    SELECT historico_importado INTO v_historico_oficio FROM public.controle_oficios WHERE id = NEW.registro_id;
    IF COALESCE(v_historico_oficio, false) THEN
      NEW.origem := 'importacao'; RETURN NEW;
    END IF;
    NEW.origem := 'manual';
    IF NEW.acao = 'Criado' THEN
      NEW.conta_produtividade := true; NEW.categoria_produtividade := 'Ofícios';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Movimentações' THEN
    SELECT origem INTO v_origem_movimentacao FROM public.movimentacoes WHERE id = NEW.registro_id;
    IF v_origem_movimentacao = 'manual' THEN
      NEW.origem := 'manual';
      IF NEW.acao = 'Criado' THEN
        NEW.conta_produtividade := true; NEW.categoria_produtividade := 'Movimentações';
      END IF;
    ELSIF v_origem_movimentacao = 'pje_tjba' THEN
      NEW.origem := 'importacao';
    ELSE
      NEW.origem := 'indefinida';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Réus' THEN
    NEW.origem := 'indefinida'; RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;



CREATE OR REPLACE FUNCTION public.salvar_audiencia_importada(
  p_id uuid,
  p_processo_id uuid,
  p_tipo text,
  p_data date,
  p_horario time without time zone,
  p_modalidade text,
  p_local text,
  p_situacao text,
  p_observacao text,
  p_aguardando_nova_data boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para importar audiência';
  END IF;

  PERFORM set_config('app.origem_operacao', 'importacao', true);

  IF p_id IS NULL THEN
    INSERT INTO public.audiencias (
      processo_id, tipo, data, horario, modalidade, local, situacao,
      observacao, aguardando_nova_data
    )
    VALUES (
      p_processo_id, p_tipo, p_data, p_horario, p_modalidade, p_local,
      p_situacao, COALESCE(p_observacao, ''), COALESCE(p_aguardando_nova_data, false)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.audiencias
    SET tipo = p_tipo,
        data = p_data,
        horario = p_horario,
        modalidade = p_modalidade,
        local = p_local,
        situacao = p_situacao,
        observacao = COALESCE(p_observacao, ''),
        aguardando_nova_data = COALESCE(p_aguardando_nova_data, false)
    WHERE id = p_id
      AND processo_id = p_processo_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Audiência não encontrada para o processo informado';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_audiencia_importada(
  uuid, uuid, text, date, time without time zone, text, text, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_audiencia_importada(
  uuid, uuid, text, date, time without time zone, text, text, text, text, boolean
) TO authenticated;
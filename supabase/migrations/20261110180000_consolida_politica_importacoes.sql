-- Etapa 4 — política previsível de importações.
-- Acervo: campos operacionais do PJe podem ser limpos quando a coluna existe e vem vazia.
-- Presos provisórios: preserva classificações manuais, encerramentos e metadados de outros módulos.
-- Comparecimentos: histórico local mais recente prevalece, o próximo comparecimento nunca retrocede
-- e cadastros antigos sem processo podem ser vinculados sem duplicação.

CREATE OR REPLACE FUNCTION public.importar_processos(p_arquivo text, p_linhas jsonb, p_erros jsonb, p_ignorados jsonb, p_aplicar_conflitos boolean, p_simular boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  campos text[] := ARRAY[
    'classe','assunto','data_distribuicao','pje_classe_codigo',
    'pje_ultima_mov_data','pje_ultima_mov_descricao','pje_qtde_dias',
    'pje_situacao','pje_tarefas','pje_autor','pje_reu','pje_prioridade',
    'pje_descricao_prioridade','pje_concluso','pje_segredo',
    'pje_localizacao','pje_sistema'
  ];
  limpar_vazio text[] := ARRAY[
    'pje_qtde_dias','pje_situacao','pje_tarefas','pje_prioridade',
    'pje_descricao_prioridade','pje_concluso','pje_segredo',
    'pje_localizacao','pje_sistema'
  ];
  mov_campos text[] := ARRAY['pje_ultima_mov_data','pje_ultima_mov_descricao','pje_qtde_dias'];
  presentes text[];
  l jsonb; c jsonb; atual jsonb; p public.processos; v_id uuid; v_imp uuid; v_num int;
  f text; novo text; velho text; antes jsonb; depois jsonb; mudancas jsonb; confl jsonb; ref_data date;
  tem_conflito boolean; pula_mov boolean; v_mov uuid; v_reus uuid[]; nome text; merged jsonb; descr text;
  r_novos jsonb := '[]'; r_atual jsonb := '[]'; r_confl jsonb := '[]'; n_sem int := 0; n_proc int := 0;
  uname text := public.auditoria_nome(auth.uid()); status_final text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para importar processos';
  END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Estrutura inválida';
  END IF;
  IF NOT p_simular THEN
    PERFORM set_config('app.origem_operacao', 'importacao', true);
  END IF;
  IF (
    SELECT count(*) <> count(DISTINCT regexp_replace(x->>'numero','\D','','g'))
    FROM jsonb_array_elements(p_linhas) x
  ) THEN
    RAISE EXCEPTION 'A planilha contém processos duplicados; nada foi alterado';
  END IF;

  IF NOT p_simular THEN
    INSERT INTO importacoes (usuario_id, usuario_nome, arquivo)
    VALUES (auth.uid(), uname, left(p_arquivo, 255))
    RETURNING id, numero INTO v_imp, v_num;
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    n_proc := n_proc + 1;
    c := COALESCE(l->'campos', '{}'::jsonb);

    SELECT COALESCE(array_agg(x.valor), ARRAY[]::text[])
      INTO presentes
      FROM jsonb_array_elements_text(COALESCE(l->'campos_presentes', '[]'::jsonb)) AS x(valor);

    -- Compatibilidade com clientes antigos: sem a lista explícita, considera
    -- presentes apenas os campos enviados no objeto "campos".
    IF COALESCE(array_length(presentes, 1), 0) = 0 THEN
      SELECT COALESCE(array_agg(x.chave), ARRAY[]::text[])
        INTO presentes
        FROM jsonb_object_keys(c) AS x(chave);
    END IF;

    SELECT * INTO p
      FROM processos
     WHERE regexp_replace(numero,'\D','','g') = regexp_replace(l->>'numero','\D','','g');

    IF NOT FOUND THEN
      r_novos := r_novos || jsonb_build_object(
        'numero', l->>'numero',
        'linha', l->'linha',
        'classe', c->>'classe',
        'reu', c->>'pje_reu'
      );

      IF NOT p_simular THEN
        merged := jsonb_build_object(
          'numero', l->>'numero',
          'classe', COALESCE(NULLIF(c->>'classe',''), 'Não informada'),
          'origem', 'pje_tjba'
        ) || (c - 'classe');

        INSERT INTO processos (
          numero, classe, origem, assunto, data_distribuicao, pje_classe_codigo,
          pje_ultima_mov_data, pje_ultima_mov_descricao, pje_qtde_dias,
          pje_situacao, pje_tarefas, pje_autor, pje_reu, pje_prioridade,
          pje_descricao_prioridade, pje_concluso, pje_segredo,
          pje_localizacao, pje_sistema
        )
        SELECT
          r.numero, r.classe, r.origem, COALESCE(r.assunto,''), r.data_distribuicao,
          r.pje_classe_codigo, r.pje_ultima_mov_data, r.pje_ultima_mov_descricao,
          r.pje_qtde_dias, r.pje_situacao, r.pje_tarefas, r.pje_autor, r.pje_reu,
          r.pje_prioridade, r.pje_descricao_prioridade, r.pje_concluso,
          r.pje_segredo, r.pje_localizacao, r.pje_sistema
        FROM jsonb_populate_record(NULL::processos, merged) r
        RETURNING id INTO v_id;

        v_reus := '{}';
        v_mov := NULL;

        IF NULLIF(trim(c->>'pje_reu'),'') IS NOT NULL THEN
          FOR nome IN
            SELECT trim(x)
            FROM regexp_split_to_table(c->>'pje_reu', '\s*[;\n]\s*') x
            WHERE trim(x) <> ''
          LOOP
            INSERT INTO reus (processo_id, nome, ordem)
            VALUES (v_id, nome, COALESCE(array_length(v_reus,1),0))
            RETURNING id INTO v_mov;
            v_reus := v_reus || v_mov;
          END LOOP;
          v_mov := NULL;
        END IF;

        IF c ? 'pje_ultima_mov_data'
           AND NULLIF(c->>'pje_ultima_mov_descricao','') IS NOT NULL THEN
          INSERT INTO movimentacoes (processo_id, data, descricao, origem, id_externo)
          VALUES (
            v_id,
            (c->>'pje_ultima_mov_data')::date,
            c->>'pje_ultima_mov_descricao',
            'pje_tjba',
            'importacao:' || v_imp
          )
          RETURNING id INTO v_mov;
        END IF;

        INSERT INTO importacao_itens (
          importacao_id, processo_id, numero, linha, acao, depois,
          movimentacao_id, reus_ids
        )
        VALUES (
          v_imp, v_id, l->>'numero', (l->>'linha')::int, 'criado',
          merged, v_mov, v_reus
        );

        INSERT INTO auditoria (
          usuario_id, usuario_nome, acao, modulo, registro_id,
          processo_id, processo_numero, descricao
        )
        VALUES (
          auth.uid(), uname, 'Importação', 'Importação', v_imp,
          v_id, l->>'numero',
          'Processo criado pela Importação #' || v_num || ' (' || left(p_arquivo, 80) || ')'
        );
      END IF;
      CONTINUE;
    END IF;

    atual := to_jsonb(p);

    SELECT max(data) INTO ref_data
      FROM movimentacoes
     WHERE processo_id = p.id;
    ref_data := GREATEST(ref_data, p.pje_ultima_mov_data);

    tem_conflito := false;
    pula_mov := false;
    confl := '[]';

    IF c ? 'pje_ultima_mov_data'
       AND ref_data IS NOT NULL
       AND (c->>'pje_ultima_mov_data')::date < ref_data THEN
      tem_conflito := true;
      confl := confl || jsonb_build_object(
        'numero', p.numero,
        'campo', 'pje_ultima_mov_data',
        'atual', ref_data,
        'novo', c->>'pje_ultima_mov_data',
        'motivo', 'A data da última movimentação na planilha é anterior à registrada no sistema'
      );
      pula_mov := NOT p_aplicar_conflitos;
    END IF;

    IF c ? 'data_distribuicao'
       AND p.data_distribuicao IS NOT NULL
       AND p.data_distribuicao::text <> c->>'data_distribuicao' THEN
      tem_conflito := true;
      confl := confl || jsonb_build_object(
        'numero', p.numero,
        'campo', 'data_distribuicao',
        'atual', p.data_distribuicao,
        'novo', c->>'data_distribuicao',
        'motivo', 'Data de autuação diferente da cadastrada'
      );
    END IF;

    r_confl := r_confl || confl;
    antes := '{}';
    depois := '{}';
    mudancas := '[]';

    FOREACH f IN ARRAY campos LOOP
      CONTINUE WHEN NOT (f = ANY(presentes));
      CONTINUE WHEN pula_mov AND f = ANY(mov_campos);
      CONTINUE WHEN f = 'data_distribuicao'
                    AND p.data_distribuicao IS NOT NULL
                    AND NOT p_aplicar_conflitos;

      novo := NULLIF(trim(c->>f), '');
      velho := atual->>f;

      IF novo IS NULL THEN
        -- Vazio só limpa campos de espelho operacional do PJe.
        CONTINUE WHEN NOT (f = ANY(limpar_vazio));
        IF NULLIF(trim(COALESCE(velho, '')), '') IS NOT NULL THEN
          antes := antes || jsonb_build_object(f, atual->f);
          depois := depois || jsonb_build_object(f, NULL);
          mudancas := mudancas || jsonb_build_object(
            'campo', f,
            'antes', velho,
            'depois', NULL
          );
        END IF;
        CONTINUE;
      END IF;

      IF velho IS DISTINCT FROM novo THEN
        antes := antes || jsonb_build_object(f, atual->f);
        depois := depois || jsonb_build_object(f, c->f);
        mudancas := mudancas || jsonb_build_object(
          'campo', f,
          'antes', velho,
          'depois', novo
        );
      END IF;
    END LOOP;

    IF depois = '{}'::jsonb THEN
      n_sem := n_sem + 1;
      CONTINUE;
    END IF;

    r_atual := r_atual || jsonb_build_object(
      'numero', p.numero,
      'linha', l->'linha',
      'mudancas', mudancas,
      'conflito', tem_conflito
    );

    IF NOT p_simular THEN
      merged := atual || depois;

      UPDATE processos t
         SET classe = r.classe,
             assunto = r.assunto,
             data_distribuicao = r.data_distribuicao,
             pje_classe_codigo = r.pje_classe_codigo,
             pje_ultima_mov_data = r.pje_ultima_mov_data,
             pje_ultima_mov_descricao = r.pje_ultima_mov_descricao,
             pje_qtde_dias = r.pje_qtde_dias,
             pje_situacao = r.pje_situacao,
             pje_tarefas = r.pje_tarefas,
             pje_autor = r.pje_autor,
             pje_reu = r.pje_reu,
             pje_prioridade = r.pje_prioridade,
             pje_descricao_prioridade = r.pje_descricao_prioridade,
             pje_concluso = r.pje_concluso,
             pje_segredo = r.pje_segredo,
             pje_localizacao = r.pje_localizacao,
             pje_sistema = r.pje_sistema
      FROM jsonb_populate_record(NULL::processos, merged) r
      WHERE t.id = p.id;

      v_mov := NULL;

      IF NOT pula_mov
         AND depois ? 'pje_ultima_mov_data'
         AND NULLIF(c->>'pje_ultima_mov_descricao','') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM movimentacoes m
           WHERE m.processo_id = p.id
             AND m.data = (c->>'pje_ultima_mov_data')::date
             AND m.descricao = c->>'pje_ultima_mov_descricao'
         ) THEN
        INSERT INTO movimentacoes (processo_id, data, descricao, origem, id_externo)
        VALUES (
          p.id,
          (c->>'pje_ultima_mov_data')::date,
          c->>'pje_ultima_mov_descricao',
          'pje_tjba',
          'importacao:' || v_imp
        )
        RETURNING id INTO v_mov;
      END IF;

      INSERT INTO importacao_itens (
        importacao_id, processo_id, numero, linha, acao,
        antes, depois, movimentacao_id
      )
      VALUES (
        v_imp, p.id, p.numero, (l->>'linha')::int, 'atualizado',
        antes, depois, v_mov
      );

      SELECT string_agg(
        public.rotulo_campo_importacao(x->>'campo') || ': ' ||
        COALESCE(x->>'antes','(vazio)') || ' → ' ||
        COALESCE(x->>'depois','(vazio)'),
        '; '
      )
      INTO descr
      FROM jsonb_array_elements(mudancas) x;

      INSERT INTO auditoria (
        usuario_id, usuario_nome, acao, modulo, registro_id,
        processo_id, processo_numero, descricao
      )
      VALUES (
        auth.uid(), uname, 'Importação', 'Importação', v_imp,
        p.id, p.numero,
        'Importação #' || v_num || ' — ' || left(descr, 1500)
      );
    END IF;
  END LOOP;

  IF p_simular THEN
    RETURN jsonb_build_object(
      'analisados', n_proc,
      'novos', r_novos,
      'atualizados', r_atual,
      'sem_alteracao', n_sem,
      'conflitos', r_confl
    );
  END IF;

  status_final := CASE
    WHEN jsonb_array_length(r_confl) > 0
      OR jsonb_array_length(COALESCE(p_erros,'[]')) > 0
      OR jsonb_array_length(COALESCE(p_ignorados,'[]')) > 0
    THEN 'Concluída com alertas'
    ELSE 'Concluída'
  END;

  UPDATE importacoes
     SET analisados = n_proc
         + jsonb_array_length(COALESCE(p_erros,'[]'))
         + jsonb_array_length(COALESCE(p_ignorados,'[]')),
         novos = jsonb_array_length(r_novos),
         atualizados = jsonb_array_length(r_atual),
         sem_alteracao = n_sem,
         ignorados = jsonb_array_length(COALESCE(p_ignorados,'[]')),
         conflitos = jsonb_array_length(r_confl),
         erros = jsonb_array_length(COALESCE(p_erros,'[]')),
         status = status_final,
         detalhes = jsonb_build_object(
           'erros', COALESCE(p_erros,'[]'),
           'ignorados', COALESCE(p_ignorados,'[]'),
           'conflitos', r_confl,
           'conflitos_aplicados', p_aplicar_conflitos
         )
   WHERE id = v_imp;

  INSERT INTO auditoria (
    usuario_id, usuario_nome, acao, modulo, registro_id, descricao
  )
  VALUES (
    auth.uid(), uname, 'Importação', 'Importação', v_imp,
    'Importação #' || v_num || ' (' || left(p_arquivo,80) || '): ' ||
    jsonb_array_length(r_novos) || ' novos, ' ||
    jsonb_array_length(r_atual) || ' atualizados, ' ||
    n_sem || ' sem alteração'
  );

  RETURN jsonb_build_object('id', v_imp, 'numero', v_num, 'status', status_final);
END
$function$;

CREATE OR REPLACE FUNCTION public.importar_reus_presos(p_arquivo text, p_linhas jsonb, p_erros integer, p_simular boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l jsonb; tipo text; n text; d text; pid uuid; pnum text; fmt text; rel jsonb; ancora uuid; ids uuid[];
  r reus; novo_rel jsonb; motivo text; nome_n text; rji_d text;
  tp_importado text; tp_anterior text; tp_final text;
  preso_v boolean; preso_final boolean; reativando boolean;
  data_importada date; data_final date; ultimo_encerramento date;
  situacao_final text; dados_final jsonb;
  item jsonb; mudou boolean;
  novos jsonb := '[]'; atual jsonb := '[]'; criados jsonb := '[]'; naovinc jsonb := '[]'; simulados text[] := '{}';
  iguais int := 0; encontrados int := 0; uname text := public.auditoria_nome(auth.uid());
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para importar réus presos';
  END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Estrutura inválida';
  END IF;
  IF NOT p_simular THEN
    PERFORM set_config('app.origem_operacao', 'importacao', true);
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    rel := '[]';
    ancora := NULL;
    ids := '{}';
    motivo := '';

    FOREACH tipo IN ARRAY ARRAY['acao_penal','cautelar','ip'] LOOP
      FOR n IN SELECT jsonb_array_elements_text(coalesce(l->tipo,'[]')) LOOP
        d := regexp_replace(n,'\D','','g');
        pid := NULL;
        pnum := NULL;

        IF length(d) >= 10 THEN
          SELECT id, numero INTO pid, pnum
          FROM processos
          WHERE regexp_replace(numero,'\D','','g') = d
          LIMIT 1;
        END IF;

        IF pid IS NOT NULL THEN
          encontrados := encontrados + 1;
          rel := rel || jsonb_build_object(
            'tipo', tipo, 'numero', pnum, 'processo_id', pid, 'situacao', 'encontrado'
          );
        ELSIF length(d) = 20 THEN
          fmt := substr(d,1,7)||'-'||substr(d,8,2)||'.'||substr(d,10,4)||'.'||substr(d,14,1)||'.'||substr(d,15,2)||'.'||substr(d,17,4);

          IF NOT d = ANY(simulados) THEN
            simulados := simulados || d;
            criados := criados || jsonb_build_object(
              'numero', fmt, 'tipo', tipo, 'preso', l->>'nome', 'linha', l->'linha'
            );
          END IF;

          IF NOT p_simular THEN
            INSERT INTO processos (numero, classe, origem, conferir)
            VALUES (fmt, 'Não informada', 'manual', true)
            RETURNING id INTO pid;
          END IF;

          rel := rel || jsonb_build_object(
            'tipo', tipo, 'numero', fmt, 'processo_id', pid, 'situacao', 'criado'
          );
          motivo := motivo || 'Processo ' || fmt || ' criado pela importação — conferir. ';
        ELSE
          rel := rel || jsonb_build_object(
            'tipo', tipo, 'numero', trim(n), 'processo_id', NULL, 'situacao', 'nao_vinculado'
          );
          naovinc := naovinc || jsonb_build_object(
            'linha', l->'linha', 'preso', l->>'nome', 'tipo', tipo, 'numero', trim(n)
          );
          motivo := motivo || 'Número "' || trim(n) || '" não vinculado a processo cadastrado — conferir. ';
        END IF;

        IF pid IS NOT NULL THEN
          ids := ids || pid;
          IF ancora IS NULL THEN ancora := pid; END IF;
        END IF;
      END LOOP;
    END LOOP;

    IF jsonb_array_length(rel) = 0 THEN
      motivo := 'Sem processo informado na planilha — conferir. ';
    END IF;

    nome_n := lower(unaccent_safe(trim(l->>'nome')));
    rji_d := regexp_replace(coalesce(l->>'rji',''),'\s','','g');
    r := NULL;

    IF rji_d <> '' THEN
      SELECT * INTO r
      FROM reus x
      WHERE regexp_replace(x.rji,'\s','','g') = rji_d
        AND (
          CASE
            WHEN cardinality(ids) > 0 THEN (
              x.processo_id = ANY(ids)
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(x.processos_relacionados) e
                WHERE (e->>'processo_id') IS NOT NULL
                  AND (e->>'processo_id')::uuid = ANY(ids)
              )
            )
            ELSE x.processo_id IS NULL
          END
        )
      ORDER BY x.preso DESC
      LIMIT 1;
    END IF;

    IF r.id IS NULL AND cardinality(ids) > 0 THEN
      SELECT * INTO r
      FROM reus x
      WHERE lower(unaccent_safe(trim(x.nome))) = nome_n
        AND (x.rji = '' OR rji_d = '')
        AND (
          x.processo_id = ANY(ids)
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(x.processos_relacionados) e
            WHERE (e->>'processo_id')::uuid = ANY(ids)
          )
        )
      ORDER BY x.preso DESC
      LIMIT 1;
    END IF;

    IF r.id IS NULL AND cardinality(ids) = 0 THEN
      SELECT * INTO r
      FROM reus x
      WHERE x.processo_id IS NULL
        AND lower(unaccent_safe(trim(x.nome))) = nome_n
        AND (x.rji = '' OR rji_d = '')
      LIMIT 1;
    END IF;

    tp_importado := l->>'tipo_prisao';
    preso_v := coalesce((l->>'preso')::boolean, true);
    data_importada := NULLIF(l->>'data_prisao','')::date;

    item := jsonb_build_object(
      'linha', l->'linha',
      'nome', l->>'nome',
      'rji', l->>'rji',
      'especie', l->>'especie',
      'processos', rel,
      'motivo', trim(motivo)
    );

    IF r.id IS NULL THEN
      novos := novos || item;
      IF NOT p_simular THEN
        INSERT INTO reus (
          processo_id, nome, situacao, preso, tipo_prisao, data_prisao,
          rji, especie_cautelar, dados_planilha, processos_relacionados,
          conferir, motivo_conferencia, ordem
        )
        VALUES (
          ancora,
          left(trim(l->>'nome'),200),
          left(coalesce(l->>'situacao',''),200),
          preso_v,
          tp_importado,
          data_importada,
          left(coalesce(l->>'rji',''),50),
          left(coalesce(l->>'especie',''),200),
          coalesce(l->'dados','{}'),
          rel,
          motivo <> '',
          left(trim(motivo),1000),
          coalesce((SELECT count(*) FROM reus WHERE processo_id = ancora),0)
        );
      END IF;
    ELSE
      novo_rel := rel || coalesce((
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(r.processos_relacionados) e
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(rel) x
          WHERE regexp_replace(x->>'numero','\D','','g') =
                regexp_replace(e->>'numero','\D','','g')
        )
      ), '[]');

      -- Substitui apenas a parcela pertencente à planilha de presos.
      -- Metadados de outros módulos (ex.: pauta_audiencia) são preservados.
      dados_final :=
        (coalesce(r.dados_planilha, '{}'::jsonb) - ARRAY[
          'Andamento do último procedimento',
          'Término de eventual prazo',
          'Última reavaliação',
          'Prazo de reavaliação',
          'Data de reavaliação',
          'Dias preso (planilha)',
          'Sistema'
        ]) || coalesce(l->'dados','{}');

      SELECT max(data_encerramento)
        INTO ultimo_encerramento
        FROM reu_prisoes_encerradas
       WHERE reu_id = r.id;

      reativando := false;

      IF r.preso AND NOT preso_v THEN
        -- A planilha não possui data segura de soltura. Encerramento continua
        -- sendo uma ação manual para preservar o histórico prisional.
        preso_final := true;
        motivo := motivo || 'A planilha indica situação sem prisão, mas o cadastro ativo foi preservado; encerre a prisão manualmente para registrar a data. ';
      ELSIF r.preso THEN
        preso_final := true;
      ELSIF preso_v
            AND data_importada IS NOT NULL
            AND (ultimo_encerramento IS NULL OR data_importada > ultimo_encerramento) THEN
        preso_final := true;
        reativando := true;
      ELSIF preso_v THEN
        preso_final := false;
        motivo := motivo || 'A planilha indica prisão, mas não há nova data posterior ao último encerramento; o cadastro encerrado foi preservado. ';
      ELSE
        preso_final := false;
      END IF;

      tp_anterior := CASE
        WHEN NULLIF(trim(coalesce(r.especie_cautelar,'')), '') IS NULL THEN NULL
        WHEN upper(unaccent_safe(r.especie_cautelar)) LIKE '%PREVENT%' THEN 'Prisão preventiva'
        WHEN upper(unaccent_safe(r.especie_cautelar)) LIKE '%TEMPOR%' THEN 'Prisão temporária'
        WHEN upper(unaccent_safe(r.especie_cautelar)) LIKE '%FLAGRAN%' THEN 'Prisão em flagrante'
        ELSE 'Outra'
      END;

      tp_final := CASE
        WHEN NOT preso_final THEN r.tipo_prisao
        WHEN reativando THEN tp_importado
        WHEN NULLIF(trim(coalesce(r.tipo_prisao,'')), '') IS NULL THEN tp_importado
        WHEN tp_anterior IS NULL THEN r.tipo_prisao
        WHEN r.tipo_prisao = tp_anterior THEN tp_importado
        ELSE r.tipo_prisao
      END;

      data_final := CASE
        WHEN reativando THEN data_importada
        WHEN r.preso AND preso_final THEN coalesce(data_importada, r.data_prisao)
        ELSE r.data_prisao
      END;

      situacao_final := CASE
        WHEN reativando THEN left(coalesce(l->>'situacao',''),200)
        WHEN r.preso AND NOT preso_v THEN r.situacao
        WHEN preso_final AND coalesce(l->>'situacao','') <> '' THEN left(l->>'situacao',200)
        ELSE r.situacao
      END;

      mudou :=
        r.preso IS DISTINCT FROM preso_final
        OR r.tipo_prisao IS DISTINCT FROM tp_final
        OR r.situacao IS DISTINCT FROM situacao_final
        OR r.data_prisao IS DISTINCT FROM data_final
        OR (rji_d <> '' AND r.rji = '')
        OR (
          coalesce(l->>'especie','') <> ''
          AND r.especie_cautelar IS DISTINCT FROM l->>'especie'
        )
        OR r.dados_planilha IS DISTINCT FROM dados_final
        OR r.processos_relacionados IS DISTINCT FROM novo_rel
        OR (r.processo_id IS NULL AND ancora IS NOT NULL)
        OR motivo <> '';

      IF mudou THEN
        item := item || jsonb_build_object(
          'motivo', trim(motivo),
          'tipo_preservado',
            CASE WHEN tp_final IS DISTINCT FROM tp_importado THEN tp_final ELSE NULL END,
          'prisao_preservada',
            CASE WHEN r.preso IS DISTINCT FROM preso_v AND preso_final = r.preso THEN true ELSE false END
        );
        atual := atual || item;

        IF NOT p_simular THEN
          UPDATE reus
             SET preso = preso_final,
                 tipo_prisao = tp_final,
                 situacao = situacao_final,
                 data_prisao = data_final,
                 rji = CASE
                   WHEN rji = '' THEN left(coalesce(l->>'rji',''),50)
                   ELSE rji
                 END,
                 especie_cautelar = CASE
                   WHEN coalesce(l->>'especie','') <> '' THEN left(l->>'especie',200)
                   ELSE especie_cautelar
                 END,
                 dados_planilha = dados_final,
                 processos_relacionados = novo_rel,
                 processo_id = coalesce(processo_id, ancora),
                 conferir = conferir OR motivo <> '',
                 motivo_conferencia = CASE
                   WHEN motivo <> '' THEN
                     left(
                       trim(
                         concat_ws(
                           ' · ',
                           nullif(trim(motivo_conferencia),''),
                           trim(motivo)
                         )
                       ),
                       1000
                     )
                   ELSE motivo_conferencia
                 END
           WHERE id = r.id;
        END IF;
      ELSE
        iguais := iguais + 1;
      END IF;
    END IF;
  END LOOP;

  IF NOT p_simular THEN
    INSERT INTO auditoria (
      usuario_id, usuario_nome, acao, modulo, descricao
    )
    VALUES (
      auth.uid(), uname, 'Importação', 'Réus',
      'Importação de réus presos (' || left(p_arquivo,80) || '): ' ||
      jsonb_array_length(p_linhas) || ' presos, ' ||
      jsonb_array_length(novos) || ' novos, ' ||
      jsonb_array_length(atual) || ' atualizados, ' ||
      jsonb_array_length(criados) || ' processos criados, ' ||
      coalesce(p_erros,0) || ' linhas com erro'
    );
  END IF;

  RETURN jsonb_build_object(
    'total', jsonb_array_length(p_linhas),
    'novos', novos,
    'atualizados', atual,
    'sem_alteracao', iguais,
    'processos_encontrados', encontrados,
    'processos_criados', criados,
    'nao_vinculados', naovinc
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.importar_comparecimentos(p_arquivo text, p_linhas jsonb, p_simular boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l jsonb; v_proc uuid; v_num text; n text; c comparecimentos;
  ref date; ini date; ultima_local date; ref_efetiva date;
  prox_calculado date; prox_seguro date; reparar_vinculo boolean;
  procs text[]; outros text[]; achados uuid[]; vinc text; motivo text; sug jsonb; item jsonb;
  novos jsonb := '[]'; atual jsonb := '[]'; semvinc jsonb := '[]'; corresp jsonb := '[]'; criados jsonb := '[]';
  simulados text[] := '{}'; iguais int := 0; encontrados int := 0;
  uname text := public.auditoria_nome(auth.uid()); cpf_d text; nome_n text; fmt text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para importar comparecimentos';
  END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Estrutura inválida';
  END IF;
  IF NOT p_simular THEN
    PERFORM set_config('app.origem_operacao', 'importacao', true);
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_proc := NULL;
    v_num := NULL;
    vinc := NULL;
    motivo := '';
    sug := '[]';
    c := NULL;
    reparar_vinculo := false;
    ultima_local := NULL;
    ref_efetiva := NULL;
    prox_calculado := NULL;
    prox_seguro := NULL;

    SELECT coalesce(array_agg(DISTINCT d), '{}')
      INTO procs
      FROM (
        SELECT regexp_replace(x,'\D','','g') d
        FROM jsonb_array_elements_text(coalesce(l->'processos','[]')) x
      ) s
     WHERE length(d) >= 10;

    SELECT coalesce(array_agg(DISTINCT d), '{}')
      INTO outros
      FROM (
        SELECT regexp_replace(x,'\D','','g') d
        FROM jsonb_array_elements_text(coalesce(l->'outros','[]')) x
      ) s
     WHERE length(d) >= 10;

    IF cardinality(procs) > 1 THEN
      vinc := 'multiplos';
      motivo := 'Mais de um número de processo informado na mesma célula — conferir o vínculo';
    ELSIF cardinality(procs) = 1 THEN
      SELECT id, numero INTO v_proc, v_num
      FROM processos
      WHERE regexp_replace(numero,'\D','','g') = procs[1]
      LIMIT 1;

      IF v_proc IS NOT NULL THEN
        vinc := 'encontrado';
      ELSIF procs[1] = ANY(simulados) THEN
        vinc := 'criado';
        v_num := 'novo';
      ELSIF length(procs[1]) = 20 THEN
        vinc := 'criado';
        motivo := 'Processo criado pela importação de comparecimentos — conferir';
        fmt := substr(procs[1],1,7)||'-'||substr(procs[1],8,2)||'.'||substr(procs[1],10,4)||'.'||substr(procs[1],14,1)||'.'||substr(procs[1],15,2)||'.'||substr(procs[1],17,4);
        v_num := fmt;
        simulados := simulados || procs[1];
        criados := criados || jsonb_build_object(
          'numero', fmt, 'pessoa', l->>'pessoa', 'linha', l->'linha'
        );

        IF NOT p_simular THEN
          INSERT INTO processos (numero, classe, origem, conferir)
          VALUES (fmt, 'Não informada', 'manual', true)
          RETURNING id INTO v_proc;
        END IF;
      ELSE
        vinc := 'invalido';
        motivo := 'Número de processo não reconhecido como número CNJ — conferir';
      END IF;
    ELSE
      SELECT coalesce(array_agg(DISTINCT id), '{}')
        INTO achados
        FROM processos
       WHERE regexp_replace(numero,'\D','','g') = ANY(outros);

      IF cardinality(achados) = 1 THEN
        SELECT id, numero INTO v_proc, v_num
        FROM processos
        WHERE id = achados[1];
        vinc := 'encontrado';
      ELSIF cardinality(achados) > 1 THEN
        vinc := 'multiplos';
        motivo := 'Números de IP/ação penal apontam para processos diferentes — conferir';
      ELSE
        vinc := 'sem_processo';
        motivo := 'Sem número de processo utilizável — não vinculado';
      END IF;
    END IF;

    IF vinc = 'encontrado' THEN
      encontrados := encontrados + 1;
    END IF;

    cpf_d := regexp_replace(COALESCE(l->>'cpf',''),'\D','','g');
    nome_n := lower(unaccent_safe(trim(l->>'pessoa')));

    IF vinc <> 'encontrado' THEN
      SELECT coalesce(jsonb_agg(DISTINCT p.numero), '[]')
        INTO sug
        FROM (
          SELECT p.numero
          FROM processos p
          WHERE (v_proc IS NULL OR p.id <> v_proc)
            AND (
              EXISTS (
                SELECT 1 FROM reus r
                WHERE r.processo_id = p.id
                  AND lower(unaccent_safe(trim(r.nome))) = nome_n
              )
              OR (
                length(nome_n) > 5
                AND position(nome_n IN lower(unaccent_safe(coalesce(p.pje_reu,'')))) > 0
              )
              OR EXISTS (
                SELECT 1 FROM comparecimentos x
                WHERE x.processo_id = p.id
                  AND (
                    lower(unaccent_safe(trim(x.pessoa))) = nome_n
                    OR (
                      cpf_d <> ''
                      AND regexp_replace(x.cpf,'\D','','g') = cpf_d
                    )
                  )
              )
            )
          LIMIT 3
        ) p;

      IF jsonb_array_length(sug) > 0 THEN
        corresp := corresp || jsonb_build_object(
          'linha', l->'linha',
          'pessoa', l->>'pessoa',
          'informado', l->'processos',
          'sugestoes', sug
        );
        motivo := trim(
          motivo || ' · Possível correspondência — conferir: ' ||
          (SELECT string_agg(x,', ') FROM jsonb_array_elements_text(sug) x),
          ' ·'
        );
      END IF;
    END IF;

    IF v_proc IS NOT NULL THEN
      SELECT * INTO c
      FROM comparecimentos x
      WHERE x.processo_id = v_proc
        AND (
          (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d)
          OR lower(unaccent_safe(trim(x.pessoa))) = nome_n
        )
      LIMIT 1;

      -- Repara cadastro antigo sem processo em vez de criar uma duplicidade.
      IF c.id IS NULL THEN
        SELECT * INTO c
        FROM comparecimentos x
        WHERE x.processo_id IS NULL
          AND (
            (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d)
            OR lower(unaccent_safe(trim(x.pessoa))) = nome_n
          )
        ORDER BY x.criado_em
        LIMIT 1;

        IF c.id IS NOT NULL THEN
          reparar_vinculo := true;
          motivo := trim(
            concat_ws(
              ' · ',
              nullif(trim(motivo),''),
              'Cadastro existente sem processo será vinculado ao processo encontrado'
            )
          );
        END IF;
      END IF;
    ELSIF vinc <> 'criado' THEN
      SELECT * INTO c
      FROM comparecimentos x
      WHERE x.processo_id IS NULL
        AND (
          (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d)
          OR lower(unaccent_safe(trim(x.pessoa))) = nome_n
        )
      LIMIT 1;
    END IF;

    ref := NULLIF(l->>'ultima','')::date;
    ini := COALESCE(NULLIF(l->>'aplicacao','')::date, ref);

    IF c.id IS NOT NULL THEN
      SELECT max(data_realizada)
        INTO ultima_local
        FROM comparecimento_registros
       WHERE comparecimento_id = c.id;

      ref_efetiva := GREATEST(ref, ultima_local);

      IF ref_efetiva IS NOT NULL THEN
        prox_calculado := (
          ref_efetiva + make_interval(months => (l->>'intervalo')::int)
        )::date;
      END IF;

      -- Cadastro encerrado fica operacionalmente congelado.
      -- Cadastro ativo pode avançar, mas nunca retrocede.
      prox_seguro := CASE
        WHEN c.situacao = 'Encerrado' THEN c.proximo
        WHEN prox_calculado IS NULL THEN c.proximo
        ELSE GREATEST(c.proximo, prox_calculado)
      END;
    ELSE
      prox_calculado := CASE
        WHEN ref IS NOT NULL THEN
          (ref + make_interval(months => (l->>'intervalo')::int))::date
        WHEN ini IS NOT NULL THEN
          (ini + make_interval(months => (l->>'intervalo')::int))::date
        ELSE NULL
      END;
      prox_seguro := prox_calculado;
    END IF;

    item := l || jsonb_build_object(
      'numero', v_num,
      'vinculo', vinc,
      'motivo', motivo,
      'sugestoes', sug
    );

    IF v_proc IS NULL AND vinc <> 'criado' THEN
      semvinc := semvinc || item;
    END IF;

    IF c.id IS NULL THEN
      novos := novos || (
        item || jsonb_build_object('proximo', prox_seguro)
      );

      IF NOT p_simular THEN
        INSERT INTO comparecimentos (
          processo_id, pessoa, cpf, data_inicio, periodicidade,
          intervalo_meses, proximo, observacao, situacao,
          dados_planilha, conferir, motivo_conferencia, numeros_informados
        )
        VALUES (
          v_proc,
          left(trim(l->>'pessoa'),200),
          left(COALESCE(l->>'cpf',''),20),
          ini,
          l->>'periodicidade',
          (l->>'intervalo')::int,
          prox_seguro,
          '',
          'Ativo',
          COALESCE(l->'dados','{}'),
          motivo <> '',
          left(motivo, 500),
          ARRAY(
            SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))
          )
        );
      END IF;

    ELSIF
      (
        c.situacao <> 'Encerrado'
        AND (
          c.periodicidade IS DISTINCT FROM l->>'periodicidade'
          OR c.intervalo_meses <> (l->>'intervalo')::int
          OR c.proximo IS DISTINCT FROM prox_seguro
        )
      )
      OR (cpf_d <> '' AND c.cpf = '')
      OR c.dados_planilha IS DISTINCT FROM COALESCE(l->'dados','{}')
      OR c.numeros_informados IS DISTINCT FROM ARRAY(
        SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))
      )
      OR reparar_vinculo
    THEN
      atual := atual || (
        item || jsonb_build_object(
          'proximo_antes', c.proximo,
          'proximo', prox_seguro,
          'vinculo_reparado', reparar_vinculo,
          'ultima_realizada_local', ultima_local
        )
      );

      IF NOT p_simular THEN
        UPDATE comparecimentos
           SET periodicidade = CASE
                 WHEN situacao = 'Encerrado' THEN periodicidade
                 ELSE l->>'periodicidade'
               END,
               intervalo_meses = CASE
                 WHEN situacao = 'Encerrado' THEN intervalo_meses
                 ELSE (l->>'intervalo')::int
               END,
               proximo = CASE
                 WHEN situacao = 'Encerrado' THEN proximo
                 ELSE prox_seguro
               END,
               cpf = CASE
                 WHEN cpf = '' THEN left(COALESCE(l->>'cpf',''),20)
                 ELSE cpf
               END,
               dados_planilha = COALESCE(l->'dados','{}'),
               numeros_informados = ARRAY(
                 SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))
               ),
               processo_id = CASE
                 WHEN reparar_vinculo THEN v_proc
                 ELSE processo_id
               END,
               conferir = CASE
                 WHEN reparar_vinculo THEN false
                 WHEN processo_id IS NULL THEN true
                 ELSE conferir
               END,
               motivo_conferencia = CASE
                 WHEN reparar_vinculo THEN ''
                 WHEN processo_id IS NULL AND motivo <> '' THEN left(motivo,500)
                 ELSE motivo_conferencia
               END
         WHERE id = c.id;
      END IF;
    ELSE
      iguais := iguais + 1;
    END IF;

    c := NULL;
  END LOOP;

  IF NOT p_simular THEN
    INSERT INTO auditoria (
      usuario_id, usuario_nome, acao, modulo, descricao
    )
    VALUES (
      auth.uid(), uname, 'Importação', 'Comparecimentos',
      'Importação de comparecimentos (' || left(p_arquivo,80) || '): ' ||
      jsonb_array_length(p_linhas) || ' registros, ' ||
      jsonb_array_length(novos) || ' novos, ' ||
      jsonb_array_length(atual) || ' atualizados, ' ||
      jsonb_array_length(criados) || ' processos criados, ' ||
      jsonb_array_length(semvinc) || ' não vinculados'
    );
  END IF;

  RETURN jsonb_build_object(
    'total', jsonb_array_length(p_linhas),
    'novos', novos,
    'atualizados', atual,
    'sem_alteracao', iguais,
    'nao_vinculados', semvinc,
    'processos_encontrados', encontrados,
    'processos_criados', criados,
    'correspondencias', corresp
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.importar_reus_presos(p_arquivo text, p_linhas jsonb, p_erros integer, p_simular boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l jsonb; tipo text; n text; d text; pid uuid; pnum text; fmt text; rel jsonb; ancora uuid; ids uuid[];
  r reus; novo_rel jsonb; motivo text; nome_n text; rji_d text; tp text; preso_v boolean; item jsonb; mudou boolean;
  novos jsonb := '[]'; atual jsonb := '[]'; criados jsonb := '[]'; naovinc jsonb := '[]'; simulados text[] := '{}';
  iguais int := 0; encontrados int := 0; uname text := public.auditoria_nome(auth.uid());
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para importar réus presos'; END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN RAISE EXCEPTION 'Estrutura inválida'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    rel := '[]'; ancora := NULL; ids := '{}'; motivo := '';
    FOREACH tipo IN ARRAY ARRAY['acao_penal','cautelar','ip'] LOOP
      FOR n IN SELECT jsonb_array_elements_text(coalesce(l->tipo,'[]')) LOOP
        d := regexp_replace(n,'\D','','g'); pid := NULL; pnum := NULL;
        IF length(d) >= 10 THEN SELECT id, numero INTO pid, pnum FROM processos WHERE regexp_replace(numero,'\D','','g') = d LIMIT 1; END IF;
        IF pid IS NOT NULL THEN
          encontrados := encontrados + 1;
          rel := rel || jsonb_build_object('tipo', tipo, 'numero', pnum, 'processo_id', pid, 'situacao', 'encontrado');
        ELSIF length(d) = 20 THEN
          fmt := substr(d,1,7)||'-'||substr(d,8,2)||'.'||substr(d,10,4)||'.'||substr(d,14,1)||'.'||substr(d,15,2)||'.'||substr(d,17,4);
          IF NOT d = ANY(simulados) THEN
            simulados := simulados || d;
            criados := criados || jsonb_build_object('numero', fmt, 'tipo', tipo, 'preso', l->>'nome', 'linha', l->'linha');
          END IF;
          IF NOT p_simular THEN
            INSERT INTO processos (numero, classe, origem, conferir) VALUES (fmt, 'Não informada', 'manual', true) RETURNING id INTO pid;
          END IF;
          rel := rel || jsonb_build_object('tipo', tipo, 'numero', fmt, 'processo_id', pid, 'situacao', 'criado');
          motivo := motivo || 'Processo ' || fmt || ' criado pela importação — conferir. ';
        ELSE
          rel := rel || jsonb_build_object('tipo', tipo, 'numero', trim(n), 'processo_id', NULL, 'situacao', 'nao_vinculado');
          naovinc := naovinc || jsonb_build_object('linha', l->'linha', 'preso', l->>'nome', 'tipo', tipo, 'numero', trim(n));
          motivo := motivo || 'Número "' || trim(n) || '" não vinculado a processo cadastrado — conferir. ';
        END IF;
        IF pid IS NOT NULL THEN ids := ids || pid; IF ancora IS NULL THEN ancora := pid; END IF; END IF;
      END LOOP;
    END LOOP;
    IF jsonb_array_length(rel) = 0 THEN motivo := 'Sem processo informado na planilha — conferir. '; END IF;

    nome_n := lower(unaccent_safe(trim(l->>'nome')));
    rji_d := regexp_replace(coalesce(l->>'rji',''),'\s','','g');
    r := NULL;
    IF rji_d <> '' THEN
      -- Mesmo preso (RJI) em processo diferente é outro vínculo prisional, não duplicidade.
      SELECT * INTO r FROM reus x WHERE regexp_replace(x.rji,'\s','','g') = rji_d
        AND (CASE WHEN cardinality(ids) > 0
          THEN (x.processo_id = ANY(ids) OR EXISTS (SELECT 1 FROM jsonb_array_elements(x.processos_relacionados) e WHERE (e->>'processo_id') IS NOT NULL AND (e->>'processo_id')::uuid = ANY(ids)))
          ELSE x.processo_id IS NULL END)
        ORDER BY x.preso DESC LIMIT 1;
    END IF;
    IF r.id IS NULL AND cardinality(ids) > 0 THEN
      SELECT * INTO r FROM reus x WHERE lower(unaccent_safe(trim(x.nome))) = nome_n AND (x.rji = '' OR rji_d = '')
        AND (x.processo_id = ANY(ids) OR EXISTS (SELECT 1 FROM jsonb_array_elements(x.processos_relacionados) e WHERE (e->>'processo_id')::uuid = ANY(ids)))
      ORDER BY x.preso DESC LIMIT 1;
    END IF;
    IF r.id IS NULL AND cardinality(ids) = 0 THEN
      SELECT * INTO r FROM reus x WHERE x.processo_id IS NULL AND lower(unaccent_safe(trim(x.nome))) = nome_n AND (x.rji = '' OR rji_d = '') LIMIT 1;
    END IF;

    tp := l->>'tipo_prisao';
    preso_v := coalesce((l->>'preso')::boolean, true);
    item := jsonb_build_object('linha', l->'linha', 'nome', l->>'nome', 'rji', l->>'rji', 'especie', l->>'especie', 'processos', rel, 'motivo', trim(motivo));

    IF r.id IS NULL THEN
      novos := novos || item;
      IF NOT p_simular THEN
        INSERT INTO reus (processo_id, nome, situacao, preso, tipo_prisao, data_prisao, rji, especie_cautelar, dados_planilha, processos_relacionados, conferir, motivo_conferencia, ordem)
        VALUES (ancora, left(trim(l->>'nome'),200), left(coalesce(l->>'situacao',''),200), preso_v, tp, NULLIF(l->>'data_prisao','')::date,
          left(coalesce(l->>'rji',''),50), left(coalesce(l->>'especie',''),200), coalesce(l->'dados','{}'), rel, motivo <> '', left(trim(motivo),1000),
          coalesce((SELECT count(*) FROM reus WHERE processo_id = ancora),0));
      END IF;
    ELSE
      novo_rel := rel || coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(r.processos_relacionados) e
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(rel) x WHERE regexp_replace(x->>'numero','\D','','g') = regexp_replace(e->>'numero','\D','','g'))), '[]');
      mudou := r.preso IS DISTINCT FROM preso_v OR r.tipo_prisao IS DISTINCT FROM tp
        OR (coalesce(l->>'situacao','') <> '' AND r.situacao IS DISTINCT FROM l->>'situacao')
        OR (NULLIF(l->>'data_prisao','') IS NOT NULL AND r.data_prisao IS DISTINCT FROM (l->>'data_prisao')::date)
        OR (rji_d <> '' AND r.rji = '') OR (coalesce(l->>'especie','') <> '' AND r.especie_cautelar IS DISTINCT FROM l->>'especie')
        OR r.dados_planilha IS DISTINCT FROM coalesce(l->'dados','{}') OR r.processos_relacionados IS DISTINCT FROM novo_rel
        OR (r.processo_id IS NULL AND ancora IS NOT NULL);
      IF mudou THEN
        atual := atual || item;
        IF NOT p_simular THEN
          UPDATE reus SET preso = preso_v, tipo_prisao = tp,
            situacao = CASE WHEN coalesce(l->>'situacao','') <> '' THEN left(l->>'situacao',200) ELSE situacao END,
            data_prisao = coalesce(NULLIF(l->>'data_prisao','')::date, data_prisao),
            rji = CASE WHEN rji = '' THEN left(coalesce(l->>'rji',''),50) ELSE rji END,
            especie_cautelar = CASE WHEN coalesce(l->>'especie','') <> '' THEN left(l->>'especie',200) ELSE especie_cautelar END,
            dados_planilha = coalesce(l->'dados','{}'), processos_relacionados = novo_rel,
            processo_id = coalesce(processo_id, ancora),
            conferir = conferir OR motivo <> '', motivo_conferencia = CASE WHEN motivo <> '' THEN left(trim(motivo),1000) ELSE motivo_conferencia END
          WHERE id = r.id;
        END IF;
      ELSE iguais := iguais + 1; END IF;
    END IF;
  END LOOP;

  IF NOT p_simular THEN
    INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, descricao)
    VALUES (auth.uid(), uname, 'Importação', 'Réus', 'Importação de réus presos (' || left(p_arquivo,80) || '): '
      || jsonb_array_length(p_linhas) || ' presos, ' || jsonb_array_length(novos) || ' novos, ' || jsonb_array_length(atual) || ' atualizados, '
      || jsonb_array_length(criados) || ' processos criados, ' || coalesce(p_erros,0) || ' linhas com erro');
  END IF;
  RETURN jsonb_build_object('total', jsonb_array_length(p_linhas), 'novos', novos, 'atualizados', atual, 'sem_alteracao', iguais,
    'processos_encontrados', encontrados, 'processos_criados', criados, 'nao_vinculados', naovinc);
END $function$;
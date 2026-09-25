ALTER TABLE public.comparecimentos ALTER COLUMN processo_id DROP NOT NULL;
ALTER TABLE public.comparecimentos ADD COLUMN IF NOT EXISTS conferir boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_conferencia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numeros_informados text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS conferir boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.importar_comparecimentos(p_arquivo text, p_linhas jsonb, p_simular boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  l jsonb; v_proc uuid; v_num text; n text; c comparecimentos; ref date; prox date; ini date;
  procs text[]; outros text[]; achados uuid[]; vinc text; motivo text; sug jsonb; item jsonb;
  novos jsonb := '[]'; atual jsonb := '[]'; semvinc jsonb := '[]'; corresp jsonb := '[]'; criados jsonb := '[]';
  simulados text[] := '{}'; iguais int := 0; encontrados int := 0;
  uname text := public.auditoria_nome(auth.uid()); cpf_d text; nome_n text; fmt text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para importar comparecimentos'; END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN RAISE EXCEPTION 'Estrutura inválida'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_proc := NULL; v_num := NULL; vinc := NULL; motivo := ''; sug := '[]';
    SELECT coalesce(array_agg(DISTINCT d), '{}') INTO procs FROM (SELECT regexp_replace(x,'\D','','g') d FROM jsonb_array_elements_text(coalesce(l->'processos','[]')) x) s WHERE length(d) >= 10;
    SELECT coalesce(array_agg(DISTINCT d), '{}') INTO outros FROM (SELECT regexp_replace(x,'\D','','g') d FROM jsonb_array_elements_text(coalesce(l->'outros','[]')) x) s WHERE length(d) >= 10;

    IF cardinality(procs) > 1 THEN
      vinc := 'multiplos'; motivo := 'Mais de um número de processo informado na mesma célula — conferir o vínculo';
    ELSIF cardinality(procs) = 1 THEN
      SELECT id, numero INTO v_proc, v_num FROM processos WHERE regexp_replace(numero,'\D','','g') = procs[1] LIMIT 1;
      IF v_proc IS NOT NULL THEN vinc := 'encontrado';
      ELSIF procs[1] = ANY(simulados) THEN vinc := 'criado'; v_num := 'novo';
      ELSIF length(procs[1]) = 20 THEN
        vinc := 'criado'; motivo := 'Processo criado pela importação de comparecimentos — conferir';
        fmt := substr(procs[1],1,7)||'-'||substr(procs[1],8,2)||'.'||substr(procs[1],10,4)||'.'||substr(procs[1],14,1)||'.'||substr(procs[1],15,2)||'.'||substr(procs[1],17,4);
        v_num := fmt; simulados := simulados || procs[1];
        criados := criados || jsonb_build_object('numero', fmt, 'pessoa', l->>'pessoa', 'linha', l->'linha');
        IF NOT p_simular THEN
          INSERT INTO processos (numero, classe, origem, conferir) VALUES (fmt, 'Não informada', 'importacao_comparecimentos', true) RETURNING id INTO v_proc;
        END IF;
      ELSE vinc := 'invalido'; motivo := 'Número de processo não reconhecido como número CNJ — conferir';
      END IF;
    ELSE
      SELECT coalesce(array_agg(DISTINCT id), '{}') INTO achados FROM processos WHERE regexp_replace(numero,'\D','','g') = ANY(outros);
      IF cardinality(achados) = 1 THEN
        SELECT id, numero INTO v_proc, v_num FROM processos WHERE id = achados[1]; vinc := 'encontrado';
      ELSIF cardinality(achados) > 1 THEN vinc := 'multiplos'; motivo := 'Números de IP/ação penal apontam para processos diferentes — conferir';
      ELSE vinc := 'sem_processo'; motivo := 'Sem número de processo utilizável — não vinculado';
      END IF;
    END IF;
    IF vinc = 'encontrado' THEN encontrados := encontrados + 1; END IF;

    cpf_d := regexp_replace(COALESCE(l->>'cpf',''),'\D','','g');
    nome_n := lower(unaccent_safe(trim(l->>'pessoa')));

    IF vinc <> 'encontrado' THEN
      SELECT coalesce(jsonb_agg(DISTINCT p.numero), '[]') INTO sug FROM (
        SELECT p.numero FROM processos p WHERE (v_proc IS NULL OR p.id <> v_proc) AND (
          EXISTS (SELECT 1 FROM reus r WHERE r.processo_id = p.id AND lower(unaccent_safe(trim(r.nome))) = nome_n)
          OR (length(nome_n) > 5 AND position(nome_n IN lower(unaccent_safe(coalesce(p.pje_reu,'')))) > 0)
          OR EXISTS (SELECT 1 FROM comparecimentos x WHERE x.processo_id = p.id AND (lower(unaccent_safe(trim(x.pessoa))) = nome_n OR (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d))))
        LIMIT 3) p;
      IF jsonb_array_length(sug) > 0 THEN
        corresp := corresp || jsonb_build_object('linha', l->'linha', 'pessoa', l->>'pessoa', 'informado', l->'processos', 'sugestoes', sug);
        motivo := trim(motivo || ' · Possível correspondência — conferir: ' || (SELECT string_agg(x,', ') FROM jsonb_array_elements_text(sug) x), ' ·');
      END IF;
    END IF;

    IF v_proc IS NOT NULL THEN
      SELECT * INTO c FROM comparecimentos x WHERE x.processo_id = v_proc AND (
        (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d) OR lower(unaccent_safe(trim(x.pessoa))) = nome_n) LIMIT 1;
    ELSIF vinc <> 'criado' THEN
      SELECT * INTO c FROM comparecimentos x WHERE x.processo_id IS NULL AND (
        (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d) OR lower(unaccent_safe(trim(x.pessoa))) = nome_n) LIMIT 1;
    END IF;

    ref := NULLIF(l->>'ultima','')::date;
    ini := COALESCE(NULLIF(l->>'aplicacao','')::date, ref);
    prox := CASE WHEN ref IS NOT NULL THEN (ref + make_interval(months => (l->>'intervalo')::int))::date END;
    item := l || jsonb_build_object('numero', v_num, 'vinculo', vinc, 'motivo', motivo, 'sugestoes', sug);
    IF v_proc IS NULL AND vinc <> 'criado' THEN semvinc := semvinc || item; END IF;

    IF c.id IS NULL THEN
      novos := novos || (item || jsonb_build_object('proximo', COALESCE(prox, (ini + make_interval(months => (l->>'intervalo')::int))::date)));
      IF NOT p_simular THEN
        INSERT INTO comparecimentos (processo_id, pessoa, cpf, data_inicio, periodicidade, intervalo_meses, proximo, observacao, situacao, dados_planilha, conferir, motivo_conferencia, numeros_informados)
        VALUES (v_proc, left(trim(l->>'pessoa'),200), left(COALESCE(l->>'cpf',''),20), ini, l->>'periodicidade', (l->>'intervalo')::int,
          COALESCE(prox, (ini + make_interval(months => (l->>'intervalo')::int))::date), '', 'Ativo', COALESCE(l->'dados','{}'),
          motivo <> '', left(motivo, 500), ARRAY(SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))));
      END IF;
    ELSIF c.periodicidade IS DISTINCT FROM l->>'periodicidade' OR c.intervalo_meses <> (l->>'intervalo')::int
       OR (prox IS NOT NULL AND c.proximo IS DISTINCT FROM prox) OR (cpf_d <> '' AND c.cpf = '') OR c.dados_planilha IS DISTINCT FROM COALESCE(l->'dados','{}')
       OR c.numeros_informados IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))) THEN
      atual := atual || (item || jsonb_build_object('proximo_antes', c.proximo, 'proximo', COALESCE(prox, c.proximo)));
      IF NOT p_simular THEN
        UPDATE comparecimentos SET periodicidade = l->>'periodicidade', intervalo_meses = (l->>'intervalo')::int,
          proximo = COALESCE(prox, proximo), cpf = CASE WHEN cpf = '' THEN left(COALESCE(l->>'cpf',''),20) ELSE cpf END,
          dados_planilha = COALESCE(l->'dados','{}'), numeros_informados = ARRAY(SELECT jsonb_array_elements_text(coalesce(l->'numeros','[]'))),
          conferir = CASE WHEN processo_id IS NULL THEN true ELSE conferir END,
          motivo_conferencia = CASE WHEN processo_id IS NULL AND motivo <> '' THEN left(motivo,500) ELSE motivo_conferencia END
        WHERE id = c.id;
      END IF;
    ELSE iguais := iguais + 1; END IF;
    c := NULL;
  END LOOP;

  IF NOT p_simular THEN
    INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, descricao)
    VALUES (auth.uid(), uname, 'Importação', 'Comparecimentos', 'Importação de comparecimentos (' || left(p_arquivo,80) || '): '
      || jsonb_array_length(p_linhas) || ' registros, ' || jsonb_array_length(novos) || ' novos, ' || jsonb_array_length(atual) || ' atualizados, '
      || jsonb_array_length(criados) || ' processos criados, ' || jsonb_array_length(semvinc) || ' não vinculados');
  END IF;
  RETURN jsonb_build_object('total', jsonb_array_length(p_linhas), 'novos', novos, 'atualizados', atual, 'sem_alteracao', iguais,
    'nao_vinculados', semvinc, 'processos_encontrados', encontrados, 'processos_criados', criados, 'correspondencias', corresp);
END $function$;
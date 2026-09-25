ALTER TABLE public.comparecimentos ADD COLUMN IF NOT EXISTS cpf text NOT NULL DEFAULT '';
ALTER TABLE public.comparecimentos ADD COLUMN IF NOT EXISTS dados_planilha jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Importação reutilizável de comparecimentos (simulação ou gravação, tudo-ou-nada).
-- p_linhas: [{linha, numeros:[...], pessoa, cpf, periodicidade, intervalo, ultima, aplicacao, dados}]
CREATE OR REPLACE FUNCTION public.importar_comparecimentos(p_arquivo text, p_linhas jsonb, p_simular boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  l jsonb; v_proc uuid; v_num text; n text; c comparecimentos; ref date; prox date; ini date;
  novos jsonb := '[]'; atual jsonb := '[]'; semvinc jsonb := '[]'; iguais int := 0;
  uname text := public.auditoria_nome(auth.uid()); cpf_d text; nome_n text;
BEGIN
  IF NOT public.pode_editar(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para importar comparecimentos'; END IF;
  IF jsonb_typeof(p_linhas) <> 'array' THEN RAISE EXCEPTION 'Estrutura inválida'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_proc := NULL; v_num := NULL;
    FOR n IN SELECT jsonb_array_elements_text(COALESCE(l->'numeros','[]')) LOOP
      CONTINUE WHEN length(regexp_replace(n,'\D','','g')) < 10;
      SELECT id, numero INTO v_proc, v_num FROM processos WHERE regexp_replace(numero,'\D','','g') = regexp_replace(n,'\D','','g') LIMIT 1;
      EXIT WHEN v_proc IS NOT NULL;
    END LOOP;
    IF v_proc IS NULL THEN semvinc := semvinc || l; CONTINUE; END IF;

    cpf_d := regexp_replace(COALESCE(l->>'cpf',''),'\D','','g');
    nome_n := lower(unaccent_safe(trim(l->>'pessoa')));
    SELECT * INTO c FROM comparecimentos x WHERE x.processo_id = v_proc AND (
      (cpf_d <> '' AND regexp_replace(x.cpf,'\D','','g') = cpf_d) OR lower(unaccent_safe(trim(x.pessoa))) = nome_n) LIMIT 1;

    ref := NULLIF(l->>'ultima','')::date;
    ini := COALESCE(NULLIF(l->>'aplicacao','')::date, ref);
    prox := CASE WHEN ref IS NOT NULL THEN (ref + make_interval(months => (l->>'intervalo')::int))::date END;

    IF c.id IS NULL THEN
      novos := novos || (l || jsonb_build_object('numero', v_num, 'proximo', COALESCE(prox, (ini + make_interval(months => (l->>'intervalo')::int))::date)));
      IF NOT p_simular THEN
        INSERT INTO comparecimentos (processo_id, pessoa, cpf, data_inicio, periodicidade, intervalo_meses, proximo, observacao, situacao, dados_planilha)
        VALUES (v_proc, left(trim(l->>'pessoa'),200), left(COALESCE(l->>'cpf',''),20), ini, l->>'periodicidade', (l->>'intervalo')::int,
          COALESCE(prox, (ini + make_interval(months => (l->>'intervalo')::int))::date), '', 'Ativo', COALESCE(l->'dados','{}'));
      END IF;
    ELSIF c.periodicidade IS DISTINCT FROM l->>'periodicidade' OR c.intervalo_meses <> (l->>'intervalo')::int
       OR (prox IS NOT NULL AND c.proximo IS DISTINCT FROM prox) OR (cpf_d <> '' AND c.cpf = '') OR c.dados_planilha IS DISTINCT FROM COALESCE(l->'dados','{}') THEN
      atual := atual || (l || jsonb_build_object('numero', v_num, 'proximo_antes', c.proximo, 'proximo', COALESCE(prox, c.proximo)));
      IF NOT p_simular THEN
        UPDATE comparecimentos SET periodicidade = l->>'periodicidade', intervalo_meses = (l->>'intervalo')::int,
          proximo = COALESCE(prox, proximo), cpf = CASE WHEN cpf = '' THEN left(COALESCE(l->>'cpf',''),20) ELSE cpf END,
          dados_planilha = COALESCE(l->'dados','{}')
        WHERE id = c.id;
      END IF;
    ELSE iguais := iguais + 1; END IF;
    c := NULL;
  END LOOP;

  IF NOT p_simular THEN
    INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, descricao)
    VALUES (auth.uid(), uname, 'Importação', 'Comparecimentos', 'Importação de comparecimentos (' || left(p_arquivo,80) || '): '
      || jsonb_array_length(p_linhas) || ' registros, ' || jsonb_array_length(novos) || ' novos, ' || jsonb_array_length(atual) || ' atualizados, '
      || jsonb_array_length(semvinc) || ' não vinculados');
  END IF;
  RETURN jsonb_build_object('total', jsonb_array_length(p_linhas), 'novos', novos, 'atualizados', atual, 'sem_alteracao', iguais, 'nao_vinculados', semvinc);
END $$;

CREATE OR REPLACE FUNCTION public.unaccent_safe(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT translate(COALESCE(t,''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

REVOKE EXECUTE ON FUNCTION public.importar_comparecimentos(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_comparecimentos(text, jsonb, boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.rotulo_campo_importacao(_c text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _c WHEN 'classe' THEN 'Classe' WHEN 'assunto' THEN 'Assunto' WHEN 'data_distribuicao' THEN 'Data de autuação'
    WHEN 'pje_classe_codigo' THEN 'Código da classe' WHEN 'pje_ultima_mov_data' THEN 'Última movimentação (PJe)'
    WHEN 'pje_ultima_mov_descricao' THEN 'Descrição da movimentação' WHEN 'pje_qtde_dias' THEN 'Qtde. dias (PJe)'
    WHEN 'pje_situacao' THEN 'Situação (PJe)' WHEN 'pje_tarefas' THEN 'Tarefas (PJe)' WHEN 'pje_autor' THEN 'Autor'
    WHEN 'pje_reu' THEN 'Réu (PJe)' WHEN 'pje_prioridade' THEN 'Prioridade do PJe' WHEN 'pje_descricao_prioridade' THEN 'Descrição da prioridade'
    WHEN 'pje_concluso' THEN 'Concluso' WHEN 'pje_segredo' THEN 'Segredo' WHEN 'pje_localizacao' THEN 'Localização' WHEN 'pje_sistema' THEN 'Sistema'
    ELSE _c END
$$;
DO $d$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.importar_processos(text,jsonb,jsonb,jsonb,boolean,boolean)'::regprocedure),
    'string_agg(x->>''campo'' ||', 'string_agg(public.rotulo_campo_importacao(x->>''campo'') ||');
END $d$;
DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.importar_comparecimentos(text,jsonb,boolean)'::regprocedure),
    '''importacao_comparecimentos'', true', '''manual'', true');
END $$;
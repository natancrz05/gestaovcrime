DO $d$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.importar_processos(text,jsonb,jsonb,jsonb,boolean,boolean)'::regprocedure),
    '''pje'', ''importacao:''', '''pje_tjba'', ''importacao:''');
END $d$;
REVOKE EXECUTE ON FUNCTION public.importar_reus_presos(text, jsonb, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_reus_presos(text, jsonb, int, boolean) TO authenticated;
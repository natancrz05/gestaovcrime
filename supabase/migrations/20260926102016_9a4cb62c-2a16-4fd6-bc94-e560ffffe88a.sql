REVOKE EXECUTE ON FUNCTION public.registrar_reavaliacao(uuid,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_reavaliacao(uuid,date,date,text) TO authenticated;
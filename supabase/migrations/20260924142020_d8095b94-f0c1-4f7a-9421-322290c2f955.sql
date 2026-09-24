REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_ativo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eh_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_editar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_ativo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar(uuid) TO authenticated;
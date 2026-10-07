-- Reversão corretiva da otimização de funções de permissão.
-- Restaura as definições estáveis anteriores, preservando a matriz de acesso.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.usuario_ativo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE id = _user_id
      AND ativo
  )
$$;

CREATE OR REPLACE FUNCTION public.eh_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_ativo(_user_id)
    AND public.has_role(_user_id, 'administrador')
$$;

CREATE OR REPLACE FUNCTION public.pode_editar(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_ativo(_user_id)
    AND (
      public.has_role(_user_id, 'administrador')
      OR public.has_role(_user_id, 'servidor')
    )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_ativo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eh_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_editar(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_ativo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar(uuid) TO authenticated;

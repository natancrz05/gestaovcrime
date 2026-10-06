-- Consolida verificações de perfil/atividade usadas por RLS e RPCs.
-- Mantém exatamente a mesma semântica de autorização.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
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
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS u
    JOIN public.user_roles AS r
      ON r.user_id = u.id
    WHERE u.id = _user_id
      AND u.ativo
      AND r.role = 'administrador'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_editar(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS u
    JOIN public.user_roles AS r
      ON r.user_id = u.id
    WHERE u.id = _user_id
      AND u.ativo
      AND r.role IN (
        'administrador'::public.app_role,
        'servidor'::public.app_role
      )
  )
$$;

-- Reafirma explicitamente a superfície pública dessas funções SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_ativo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eh_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_editar(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_ativo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar(uuid) TO authenticated;

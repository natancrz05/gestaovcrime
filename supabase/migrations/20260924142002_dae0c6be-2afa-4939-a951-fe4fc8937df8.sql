CREATE TYPE public.app_role AS ENUM ('administrador', 'servidor', 'consulta');

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.usuario_ativo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id = _user_id AND ativo)
$$;

CREATE OR REPLACE FUNCTION public.eh_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.usuario_ativo(_user_id) AND public.has_role(_user_id, 'administrador')
$$;

CREATE OR REPLACE FUNCTION public.pode_editar(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.usuario_ativo(_user_id)
    AND (public.has_role(_user_id, 'administrador') OR public.has_role(_user_id, 'servidor'))
$$;

CREATE POLICY "usuario ve o proprio registro ou admin ve todos" ON public.usuarios
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.eh_admin(auth.uid()));
CREATE POLICY "usuario ve o proprio perfil ou admin ve todos" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.eh_admin(auth.uid()));

-- Substitui o acesso provisório aberto por regras por perfil
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['processos','partes','reus','movimentacoes','observacoes_internas','audiencias','pendencias','prioridades'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "acesso provisorio" ON public.%I', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "leitura por usuarios ativos" ON public.%I FOR SELECT TO authenticated USING (public.usuario_ativo(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "cadastro por admin ou servidor" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pode_editar(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "edicao por admin ou servidor" ON public.%I FOR UPDATE TO authenticated USING (public.pode_editar(auth.uid())) WITH CHECK (public.pode_editar(auth.uid()))', t);
    IF t = 'processos' THEN
      EXECUTE format('CREATE POLICY "exclusao somente admin" ON public.%I FOR DELETE TO authenticated USING (public.eh_admin(auth.uid()))', t);
    ELSE
      EXECUTE format('CREATE POLICY "exclusao por admin ou servidor" ON public.%I FOR DELETE TO authenticated USING (public.pode_editar(auth.uid()))', t);
    END IF;
  END LOOP;
END $$;
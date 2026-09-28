-- Limpeza controlada do módulo Réus Presos.
-- Exclusiva para administradores. Preserva processos e demais módulos.
CREATE OR REPLACE FUNCTION public.limpar_reus_presos_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  removidos integer;
  uname text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem limpar os dados de réus presos';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT count(*)::integer INTO removidos
  FROM public.reus
  WHERE preso = true;

  DELETE FROM public.reus
  WHERE preso = true;

  uname := public.auditoria_nome(auth.uid());

  INSERT INTO public.auditoria (
    usuario_id, usuario_nome, acao, modulo, descricao
  )
  VALUES (
    auth.uid(),
    uname,
    'Exclusão',
    'Réus',
    'Limpeza manual dos dados de réus presos para nova importação: ' || removidos || ' registros removidos. Processos preservados.'
  );

  RETURN jsonb_build_object(
    'removidos', removidos,
    'processos_preservados', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.limpar_reus_presos_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_reus_presos_admin() TO authenticated;

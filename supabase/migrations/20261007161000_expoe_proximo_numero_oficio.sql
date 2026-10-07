-- Expõe, de forma segura, a próxima numeração do controle de ofícios.
-- A consulta não consome o número; a confirmação continua sendo feita
-- atomicamente por criar_controle_oficio no momento do salvamento.

CREATE OR REPLACE FUNCTION public.proximo_numero_controle_oficio(
  p_ano integer
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_ultimo integer;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL OR NOT public.usuario_ativo(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar a numeração de ofícios.';
  END IF;

  IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2200 THEN
    RAISE EXCEPTION 'Ano inválido para numeração de ofícios.';
  END IF;

  SELECT contador.ultimo_numero
    INTO v_ultimo
    FROM public.controle_oficios_contadores AS contador
   WHERE contador.ano = p_ano;

  RETURN coalesce(v_ultimo, 0) + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_numero_controle_oficio(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_controle_oficio(integer)
  TO authenticated;

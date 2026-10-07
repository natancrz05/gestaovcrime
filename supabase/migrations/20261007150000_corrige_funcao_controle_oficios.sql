-- Corrige ambiguidade entre a coluna "ano" do contador e o campo
-- de retorno "ano" da função criar_controle_oficio.

CREATE OR REPLACE FUNCTION public.criar_controle_oficio(
  p_data_expedicao date,
  p_destinatario text,
  p_finalidade text,
  p_processo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  ano integer,
  sequencial integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_ano integer;
  v_sequencial integer;
  v_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL OR NOT public.pode_editar(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para cadastrar ofícios.';
  END IF;

  IF p_data_expedicao IS NULL THEN
    RAISE EXCEPTION 'Informe a data de expedição.';
  END IF;

  IF length(btrim(coalesce(p_destinatario, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe o destinatário.';
  END IF;

  IF length(btrim(coalesce(p_finalidade, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe a finalidade do ofício.';
  END IF;

  IF p_processo_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.processos p
       WHERE p.id = p_processo_id
     ) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  v_ano := extract(year FROM p_data_expedicao)::integer;

  INSERT INTO public.controle_oficios_contadores AS contador (
    ano,
    ultimo_numero
  )
  VALUES (v_ano, 1)
  ON CONFLICT ON CONSTRAINT controle_oficios_contadores_pkey
  DO UPDATE
    SET ultimo_numero = contador.ultimo_numero + 1
  RETURNING contador.ultimo_numero INTO v_sequencial;

  INSERT INTO public.controle_oficios AS oficio (
    ano,
    sequencial,
    processo_id,
    data_expedicao,
    destinatario,
    finalidade,
    criado_por
  )
  VALUES (
    v_ano,
    v_sequencial,
    p_processo_id,
    p_data_expedicao,
    btrim(p_destinatario),
    btrim(p_finalidade),
    v_uid
  )
  RETURNING oficio.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_ano, v_sequencial;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_controle_oficio(date, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_controle_oficio(date, text, text, uuid)
  TO authenticated;

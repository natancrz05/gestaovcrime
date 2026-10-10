-- Permite cadastrar ofício com número de processo informado manualmente
-- quando o processo ainda não existe no acervo interno.
-- O número é armazenado em processo_original e não cria processo fictício.

CREATE OR REPLACE FUNCTION public.criar_controle_oficio_v2(
  p_data_expedicao date,
  p_destinatario text,
  p_finalidade text,
  p_processo_id uuid DEFAULT NULL,
  p_processo_original text DEFAULT NULL
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
  v_id uuid;
  v_ano integer;
  v_sequencial integer;
  v_processo_original text;
BEGIN
  SELECT criado.id, criado.ano, criado.sequencial
    INTO v_id, v_ano, v_sequencial
    FROM public.criar_controle_oficio(
      p_data_expedicao,
      p_destinatario,
      p_finalidade,
      p_processo_id
    ) AS criado;

  v_processo_original :=
    CASE
      WHEN p_processo_id IS NULL
        THEN nullif(btrim(coalesce(p_processo_original, '')), '')
      ELSE NULL
    END;

  IF v_processo_original IS NOT NULL THEN
    UPDATE public.controle_oficios AS oficio
       SET processo_original = v_processo_original,
           atualizado_em = now()
     WHERE oficio.id = v_id;
  END IF;

  RETURN QUERY
  SELECT v_id, v_ano, v_sequencial;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_controle_oficio_v2(date, text, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_controle_oficio_v2(date, text, text, uuid, text)
  TO authenticated;

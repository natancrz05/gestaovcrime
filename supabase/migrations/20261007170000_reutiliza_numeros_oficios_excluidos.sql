-- Permite reutilizar somente números de ofícios gerados pelo sistema e
-- posteriormente excluídos. Lacunas do histórico importado não entram na fila.
-- A reserva/reutilização ocorre dentro da mesma transação da criação, mantendo
-- segurança em acessos simultâneos.

CREATE TABLE IF NOT EXISTS public.controle_oficios_numeros_disponiveis (
  ano integer NOT NULL,
  sequencial integer NOT NULL,
  liberado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, sequencial),
  CONSTRAINT controle_oficios_numeros_disponiveis_ano_check
    CHECK (ano BETWEEN 2000 AND 2200),
  CONSTRAINT controle_oficios_numeros_disponiveis_sequencial_check
    CHECK (sequencial > 0)
);

ALTER TABLE public.controle_oficios_numeros_disponiveis ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.controle_oficios_numeros_disponiveis TO service_role;
REVOKE ALL ON public.controle_oficios_numeros_disponiveis FROM anon, authenticated;

-- Força a exclusão a passar pela RPC, garantindo a devolução da numeração.
REVOKE DELETE ON public.controle_oficios FROM authenticated;

CREATE OR REPLACE FUNCTION public.excluir_controle_oficio(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_ano integer;
  v_sequencial integer;
  v_historico boolean;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL OR NOT public.pode_editar(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para excluir ofícios.';
  END IF;

  SELECT o.ano, o.sequencial, o.historico_importado
    INTO v_ano, v_sequencial, v_historico
    FROM public.controle_oficios AS o
   WHERE o.id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ofício não encontrado.';
  END IF;

  IF v_historico THEN
    RAISE EXCEPTION 'Registros históricos importados não podem ser excluídos.';
  END IF;

  IF v_sequencial IS NULL THEN
    RAISE EXCEPTION 'Ofício sem numeração válida para reutilização.';
  END IF;

  DELETE FROM public.controle_oficios AS o
   WHERE o.id = p_id;

  INSERT INTO public.controle_oficios_numeros_disponiveis (
    ano,
    sequencial
  )
  VALUES (
    v_ano,
    v_sequencial
  )
  ON CONFLICT (ano, sequencial) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_controle_oficio(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_controle_oficio(uuid)
  TO authenticated;

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
  v_sequencial := NULL;

  SELECT d.sequencial
    INTO v_sequencial
    FROM public.controle_oficios_numeros_disponiveis AS d
   WHERE d.ano = v_ano
   ORDER BY d.sequencial
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_sequencial IS NOT NULL THEN
    DELETE FROM public.controle_oficios_numeros_disponiveis AS d
     WHERE d.ano = v_ano
       AND d.sequencial = v_sequencial;
  ELSE
    INSERT INTO public.controle_oficios_contadores AS contador (ano, ultimo_numero)
    VALUES (v_ano, 1)
    ON CONFLICT ON CONSTRAINT controle_oficios_contadores_pkey
    DO UPDATE
      SET ultimo_numero = contador.ultimo_numero + 1
    RETURNING contador.ultimo_numero INTO v_sequencial;
  END IF;

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
  v_disponivel integer;
  v_ultimo integer;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL OR NOT public.usuario_ativo(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar a numeração de ofícios.';
  END IF;

  IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2200 THEN
    RAISE EXCEPTION 'Ano inválido para numeração de ofícios.';
  END IF;

  SELECT min(d.sequencial)
    INTO v_disponivel
    FROM public.controle_oficios_numeros_disponiveis AS d
   WHERE d.ano = p_ano;

  IF v_disponivel IS NOT NULL THEN
    RETURN v_disponivel;
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

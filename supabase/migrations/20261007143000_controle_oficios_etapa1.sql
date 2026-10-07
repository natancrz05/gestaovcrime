-- Controle de ofícios - etapa 1.
-- Somente estrutura de banco e numeração anual automática.
-- Nenhuma tela do sistema depende destas tabelas nesta etapa.
--
-- Regra:
--   1/2026, 2/2026, ... são representados por (ano, sequencial).
--   A apresentação com zero à esquerda (01/2026) será responsabilidade da interface.
--   Cada ano possui contador independente e números excluídos nunca são reutilizados.

CREATE TABLE IF NOT EXISTS public.controle_oficios_contadores (
  ano integer PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0,
  CONSTRAINT controle_oficios_contadores_numero_check
    CHECK (ultimo_numero >= 0)
);

CREATE TABLE IF NOT EXISTS public.controle_oficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  sequencial integer NOT NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  data_expedicao date NOT NULL,
  destinatario text NOT NULL,
  finalidade text NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT controle_oficios_ano_check
    CHECK (ano BETWEEN 2000 AND 2200),
  CONSTRAINT controle_oficios_sequencial_check
    CHECK (sequencial > 0),
  CONSTRAINT controle_oficios_destinatario_check
    CHECK (length(btrim(destinatario)) > 0),
  CONSTRAINT controle_oficios_finalidade_check
    CHECK (length(btrim(finalidade)) > 0),
  CONSTRAINT controle_oficios_ano_sequencial_key
    UNIQUE (ano, sequencial)
);

CREATE INDEX IF NOT EXISTS controle_oficios_ano_sequencial_idx
  ON public.controle_oficios (ano DESC, sequencial DESC);

CREATE INDEX IF NOT EXISTS controle_oficios_data_expedicao_idx
  ON public.controle_oficios (data_expedicao DESC);

CREATE INDEX IF NOT EXISTS controle_oficios_processo_id_idx
  ON public.controle_oficios (processo_id)
  WHERE processo_id IS NOT NULL;

ALTER TABLE public.controle_oficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_oficios_contadores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON public.controle_oficios TO authenticated;
GRANT ALL ON public.controle_oficios TO service_role;
GRANT ALL ON public.controle_oficios_contadores TO service_role;

DROP POLICY IF EXISTS "controle oficios leitura usuarios ativos"
  ON public.controle_oficios;
CREATE POLICY "controle oficios leitura usuarios ativos"
  ON public.controle_oficios
  FOR SELECT TO authenticated
  USING (public.usuario_ativo(auth.uid()));

DROP POLICY IF EXISTS "controle oficios edicao admin servidor"
  ON public.controle_oficios;
CREATE POLICY "controle oficios edicao admin servidor"
  ON public.controle_oficios
  FOR UPDATE TO authenticated
  USING (public.pode_editar(auth.uid()))
  WITH CHECK (public.pode_editar(auth.uid()));

DROP POLICY IF EXISTS "controle oficios exclusao admin servidor"
  ON public.controle_oficios;
CREATE POLICY "controle oficios exclusao admin servidor"
  ON public.controle_oficios
  FOR DELETE TO authenticated
  USING (public.pode_editar(auth.uid()));

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

  INSERT INTO public.controle_oficios_contadores AS contador (ano, ultimo_numero)
  VALUES (v_ano, 1)
  ON CONFLICT (ano)
  DO UPDATE
    SET ultimo_numero = contador.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_sequencial;

  INSERT INTO public.controle_oficios (
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
  RETURNING controle_oficios.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_ano, v_sequencial;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_controle_oficio(date, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_controle_oficio(date, text, text, uuid)
  TO authenticated;

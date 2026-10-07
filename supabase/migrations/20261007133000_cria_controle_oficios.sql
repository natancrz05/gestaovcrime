-- Controle anual de expedição de ofícios.
-- A sequência é controlada separadamente para nunca reutilizar número excluído.

CREATE TABLE public.oficios_contadores (
  ano integer PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0)
);

ALTER TABLE public.oficios_contadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oficios_contadores FROM anon, authenticated;

CREATE TABLE public.oficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2200),
  sequencial integer NOT NULL CHECK (sequencial > 0),
  numero text GENERATED ALWAYS AS (
    lpad(sequencial::text, 2, '0') || '/' || ano::text
  ) STORED,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  data_expedicao date NOT NULL,
  destinatario text NOT NULL CHECK (btrim(destinatario) <> ''),
  finalidade text NOT NULL CHECK (btrim(finalidade) <> ''),
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oficios_ano_sequencial_key UNIQUE (ano, sequencial),
  CONSTRAINT oficios_data_mesmo_ano_check
    CHECK (extract(year FROM data_expedicao)::integer = ano)
);

CREATE INDEX oficios_ano_sequencial_idx
  ON public.oficios (ano DESC, sequencial DESC);

CREATE INDEX oficios_data_expedicao_idx
  ON public.oficios (data_expedicao DESC);

CREATE INDEX oficios_processo_id_idx
  ON public.oficios (processo_id)
  WHERE processo_id IS NOT NULL;

ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON public.oficios TO authenticated;

CREATE POLICY "leitura oficios por usuarios ativos"
  ON public.oficios
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

CREATE POLICY "edicao oficios por admin ou servidor"
  ON public.oficios
  FOR UPDATE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())))
  WITH CHECK ((SELECT public.pode_editar(auth.uid())));

CREATE POLICY "exclusao oficios por admin ou servidor"
  ON public.oficios
  FOR DELETE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

CREATE OR REPLACE FUNCTION public.criar_oficio(
  p_processo_id uuid,
  p_data_expedicao date,
  p_destinatario text,
  p_finalidade text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ano integer;
  v_sequencial integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_editar(v_uid) THEN
    RAISE EXCEPTION 'Usuário sem permissão para cadastrar ofícios.';
  END IF;

  IF p_data_expedicao IS NULL THEN
    RAISE EXCEPTION 'Informe a data de expedição.';
  END IF;

  IF btrim(coalesce(p_destinatario, '')) = '' THEN
    RAISE EXCEPTION 'Informe o destinatário.';
  END IF;

  IF btrim(coalesce(p_finalidade, '')) = '' THEN
    RAISE EXCEPTION 'Informe a finalidade do ofício.';
  END IF;

  IF p_processo_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.processos WHERE id = p_processo_id) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  v_ano := extract(year FROM p_data_expedicao)::integer;

  INSERT INTO public.oficios_contadores (ano, ultimo_numero)
  VALUES (v_ano, 1)
  ON CONFLICT (ano)
  DO UPDATE SET ultimo_numero = public.oficios_contadores.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_sequencial;

  INSERT INTO public.oficios (
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
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_oficio(uuid, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_oficio(uuid, date, text, text)
  TO authenticated;

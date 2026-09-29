CREATE TABLE public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT 'default',
  favorita boolean NOT NULL DEFAULT false,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX etiquetas_nome_lower_uidx
  ON public.etiquetas (lower(trim(nome)));

CREATE TABLE public.processos_etiquetas (
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.etiquetas(id) ON DELETE CASCADE,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (processo_id, etiqueta_id)
);

CREATE INDEX processos_etiquetas_etiqueta_idx
  ON public.processos_etiquetas (etiqueta_id);

CREATE INDEX processos_etiquetas_processo_idx
  ON public.processos_etiquetas (processo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiquetas TO authenticated;
GRANT ALL ON public.etiquetas TO service_role;

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.processos_etiquetas TO authenticated;
GRANT ALL ON public.processos_etiquetas TO service_role;

ALTER TABLE public.processos_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura etiquetas por usuarios ativos"
  ON public.etiquetas
  FOR SELECT TO authenticated
  USING (public.usuario_ativo(auth.uid()));

CREATE POLICY "cadastro etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_editar(auth.uid())
    AND criado_por = auth.uid()
  );

CREATE POLICY "edicao etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR UPDATE TO authenticated
  USING (public.pode_editar(auth.uid()))
  WITH CHECK (public.pode_editar(auth.uid()));

CREATE POLICY "exclusao etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR DELETE TO authenticated
  USING (public.pode_editar(auth.uid()));

CREATE POLICY "leitura vinculos de etiquetas por usuarios ativos"
  ON public.processos_etiquetas
  FOR SELECT TO authenticated
  USING (public.usuario_ativo(auth.uid()));

CREATE POLICY "vinculo etiquetas por admin ou servidor"
  ON public.processos_etiquetas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_editar(auth.uid())
    AND criado_por = auth.uid()
  );

CREATE POLICY "desvinculo etiquetas por admin ou servidor"
  ON public.processos_etiquetas
  FOR DELETE TO authenticated
  USING (public.pode_editar(auth.uid()));

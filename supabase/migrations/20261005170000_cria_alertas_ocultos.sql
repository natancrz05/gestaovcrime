CREATE TABLE public.alertas_ocultos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_chave text NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX alertas_ocultos_alerta_chave_uidx
  ON public.alertas_ocultos (alerta_chave);

GRANT SELECT, INSERT, DELETE ON public.alertas_ocultos TO authenticated;
GRANT ALL ON public.alertas_ocultos TO service_role;

ALTER TABLE public.alertas_ocultos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura alertas ocultos por usuarios ativos"
  ON public.alertas_ocultos
  FOR SELECT TO authenticated
  USING (public.usuario_ativo(auth.uid()));

CREATE POLICY "ocultar alertas por admin ou servidor"
  ON public.alertas_ocultos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_editar(auth.uid())
    AND criado_por = auth.uid()
  );

CREATE POLICY "restaurar alertas por admin ou servidor"
  ON public.alertas_ocultos
  FOR DELETE TO authenticated
  USING (public.pode_editar(auth.uid()));

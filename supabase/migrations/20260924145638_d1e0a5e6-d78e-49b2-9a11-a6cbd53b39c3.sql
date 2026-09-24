ALTER TABLE public.processos
  ADD COLUMN origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','pje_tjba')),
  ADD COLUMN id_externo text,
  ADD COLUMN sync_status text NOT NULL DEFAULT 'nao_sincronizado' CHECK (sync_status IN ('nao_sincronizado','sincronizado','alteracao_pendente','erro')),
  ADD COLUMN ultima_sincronizacao timestamptz,
  ADD COLUMN ultima_alteracao_externa timestamptz,
  ADD COLUMN sync_erro text;
CREATE UNIQUE INDEX processos_origem_id_externo_uidx ON public.processos (origem, id_externo) WHERE id_externo IS NOT NULL;

ALTER TABLE public.movimentacoes
  ADD COLUMN origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','pje_tjba')),
  ADD COLUMN id_externo text;

CREATE TABLE public.integracao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('sucesso','erro','aviso')),
  mensagem text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.integracao_log TO authenticated;
GRANT ALL ON public.integracao_log TO service_role;
ALTER TABLE public.integracao_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administradores leem o registro de integracao" ON public.integracao_log
  FOR SELECT TO authenticated USING (public.eh_admin(auth.uid()));
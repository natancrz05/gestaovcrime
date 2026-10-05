-- Endurecimento de lançamento: compatibilidade funcional e índices usados
-- pelas consultas centrais do sistema. Todas as criações são idempotentes.

-- A Central consolidada trabalha com cinco níveis manuais.
ALTER TABLE public.prioridades
  DROP CONSTRAINT IF EXISTS prioridades_nivel_check;

ALTER TABLE public.prioridades
  ADD CONSTRAINT prioridades_nivel_check
  CHECK (nivel IN ('critico','alta','media','conferir','baixa'));

-- Normaliza apenas os valores legados conhecidos de etiquetas.
-- Valores desconhecidos não são apagados nem bloqueiam a migração.
UPDATE public.etiquetas
SET cor = CASE
  WHEN cor IN ('default', 'info') THEN 'informativo'
  WHEN cor = 'alerta' THEN 'atencao'
  ELSE cor
END
WHERE cor IN ('default', 'info', 'alerta');

-- Índices das relações mais percorridas pelo PostgREST e pelas telas operacionais.
CREATE INDEX IF NOT EXISTS partes_processo_idx
  ON public.partes (processo_id);

CREATE INDEX IF NOT EXISTS reus_processo_idx
  ON public.reus (processo_id);

CREATE INDEX IF NOT EXISTS reus_presos_ativos_idx
  ON public.reus (nome, processo_id)
  WHERE preso = true;

CREATE INDEX IF NOT EXISTS movimentacoes_processo_data_idx
  ON public.movimentacoes (processo_id, data DESC);

CREATE INDEX IF NOT EXISTS observacoes_internas_processo_idx
  ON public.observacoes_internas (processo_id);

CREATE INDEX IF NOT EXISTS audiencias_processo_data_idx
  ON public.audiencias (processo_id, data);

CREATE INDEX IF NOT EXISTS audiencias_situacao_data_idx
  ON public.audiencias (situacao, data);

CREATE INDEX IF NOT EXISTS pendencias_processo_prazo_idx
  ON public.pendencias (processo_id, prazo);

CREATE INDEX IF NOT EXISTS prioridades_processo_nivel_idx
  ON public.prioridades (processo_id, nivel);

CREATE INDEX IF NOT EXISTS comparecimentos_processo_idx
  ON public.comparecimentos (processo_id);

CREATE INDEX IF NOT EXISTS comparecimentos_ativos_proximo_idx
  ON public.comparecimentos (proximo)
  WHERE situacao = 'Ativo';

CREATE INDEX IF NOT EXISTS comparecimento_registros_comparecimento_data_idx
  ON public.comparecimento_registros (comparecimento_id, data_realizada DESC);

CREATE INDEX IF NOT EXISTS comparecimento_registros_processo_idx
  ON public.comparecimento_registros (processo_id);

CREATE INDEX IF NOT EXISTS reu_reavaliacoes_reu_data_idx
  ON public.reu_reavaliacoes (reu_id, data_reavaliacao DESC);

CREATE INDEX IF NOT EXISTS reu_prisoes_encerradas_reu_data_idx
  ON public.reu_prisoes_encerradas (reu_id, data_encerramento DESC);

CREATE INDEX IF NOT EXISTS importacoes_validas_criado_idx
  ON public.importacoes (criado_em DESC)
  WHERE desfeita_em IS NULL AND status <> 'Falhou';

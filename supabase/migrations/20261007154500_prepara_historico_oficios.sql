-- Prepara o controle de ofícios para receber o histórico da planilha real.
-- Os dados judiciais importados de Documento.docx permanecem apenas no banco
-- da serventia e não são versionados no repositório.
--
-- O histórico pode conter numerações duplicadas ou atípicas e datas textuais
-- inconsistentes. Os campos *_original preservam exatamente a fonte.
-- Novos ofícios continuam únicos por (ano, sequencial).

ALTER TABLE public.controle_oficios
  ADD COLUMN IF NOT EXISTS numero_original text,
  ADD COLUMN IF NOT EXISTS processo_original text,
  ADD COLUMN IF NOT EXISTS data_original text,
  ADD COLUMN IF NOT EXISTS historico_importado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fonte_importacao text,
  ADD COLUMN IF NOT EXISTS chave_importacao text;

ALTER TABLE public.controle_oficios
  ALTER COLUMN sequencial DROP NOT NULL,
  ALTER COLUMN data_expedicao DROP NOT NULL;

ALTER TABLE public.controle_oficios
  DROP CONSTRAINT IF EXISTS controle_oficios_ano_sequencial_key;

DROP INDEX IF EXISTS controle_oficios_novos_ano_sequencial_uidx;
CREATE UNIQUE INDEX controle_oficios_novos_ano_sequencial_uidx
  ON public.controle_oficios (ano, sequencial)
  WHERE historico_importado = false AND sequencial IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS controle_oficios_chave_importacao_uidx
  ON public.controle_oficios (chave_importacao);

-- O histórico real de 2026 encerra em 540/2026.
-- A próxima numeração automática deve ser 541/2026.
INSERT INTO public.controle_oficios_contadores AS contador (ano, ultimo_numero)
VALUES (2026, 540)
ON CONFLICT (ano)
DO UPDATE
  SET ultimo_numero = GREATEST(contador.ultimo_numero, EXCLUDED.ultimo_numero);

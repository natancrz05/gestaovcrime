-- Amplia apenas os níveis permitidos para prioridades manuais.
-- Mantém os níveis anteriores e todos os registros já cadastrados.
-- Um único ALTER TABLE substitui a validação de forma atômica.
ALTER TABLE public.prioridades
  DROP CONSTRAINT IF EXISTS prioridades_nivel_check,
  ADD CONSTRAINT prioridades_nivel_check
    CHECK (nivel IN ('critico', 'alta', 'media', 'conferir', 'baixa'));

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS status_cadastro text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS solicitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusado_por uuid;

UPDATE public.usuarios
SET status_cadastro = 'aprovado',
    solicitado_em = COALESCE(solicitado_em, criado_em),
    aprovado_em = COALESCE(aprovado_em, criado_em)
WHERE status_cadastro IS DISTINCT FROM 'aprovado'
   OR solicitado_em IS NULL
   OR aprovado_em IS NULL;

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_status_cadastro_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_status_cadastro_check
  CHECK (status_cadastro IN ('pendente','aprovado','recusado'));

CREATE INDEX IF NOT EXISTS usuarios_status_cadastro_idx
  ON public.usuarios (status_cadastro, solicitado_em DESC);

COMMENT ON COLUMN public.usuarios.status_cadastro IS
  'Estado do acesso: pendente, aprovado ou recusado. O perfil de acesso continua em user_roles.';

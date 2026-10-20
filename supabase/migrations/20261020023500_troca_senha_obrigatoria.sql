ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS troca_senha_obrigatoria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS senha_temporaria_em timestamptz,
  ADD COLUMN IF NOT EXISTS senha_temporaria_por uuid;

UPDATE public.usuarios
SET troca_senha_obrigatoria = false
WHERE troca_senha_obrigatoria IS DISTINCT FROM false;

CREATE INDEX IF NOT EXISTS usuarios_troca_senha_idx
  ON public.usuarios (troca_senha_obrigatoria)
  WHERE troca_senha_obrigatoria = true;

COMMENT ON COLUMN public.usuarios.troca_senha_obrigatoria IS
  'Quando true, o usuário autenticado deve definir nova senha antes de acessar o sistema.';

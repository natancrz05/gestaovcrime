-- Historico privado do Assistente da Vara.
-- PDFs e textos integrais extraidos de anexos nao sao persistidos.
CREATE TABLE IF NOT EXISTS public.assistente_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Nova conversa'
    CONSTRAINT assistente_conversas_titulo_valido CHECK (length(btrim(titulo)) BETWEEN 1 AND 120),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistente_conversas_id_usuario_unique UNIQUE (id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.assistente_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  papel text NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo text NOT NULL CHECK (char_length(conteudo) <= 35000),
  anexos text[] NOT NULL DEFAULT '{}'::text[]
    CONSTRAINT assistente_mensagens_anexos_limite CHECK (cardinality(anexos) <= 2),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistente_mensagens_conversa_dono_fkey
    FOREIGN KEY (conversa_id, usuario_id)
    REFERENCES public.assistente_conversas(id, usuario_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS assistente_conversas_usuario_atualizado_idx
  ON public.assistente_conversas (usuario_id, atualizado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS assistente_mensagens_conversa_criado_idx
  ON public.assistente_mensagens (conversa_id, criado_em ASC, id ASC);

ALTER TABLE public.assistente_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistente_mensagens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.assistente_conversas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.assistente_mensagens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistente_conversas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.assistente_mensagens TO authenticated;

CREATE POLICY assistente_conversas_select_proprio
  ON public.assistente_conversas FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);
CREATE POLICY assistente_conversas_insert_proprio
  ON public.assistente_conversas FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);
CREATE POLICY assistente_conversas_update_proprio
  ON public.assistente_conversas FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = usuario_id)
  WITH CHECK ((SELECT auth.uid()) = usuario_id);
CREATE POLICY assistente_conversas_delete_proprio
  ON public.assistente_conversas FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE POLICY assistente_mensagens_select_proprio
  ON public.assistente_mensagens FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);
CREATE POLICY assistente_mensagens_insert_proprio
  ON public.assistente_mensagens FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);
CREATE POLICY assistente_mensagens_delete_proprio
  ON public.assistente_mensagens FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE OR REPLACE FUNCTION public.assistente_atualizar_conversa_em_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.assistente_conversas
  SET atualizado_em = now()
  WHERE id = NEW.conversa_id AND usuario_id = NEW.usuario_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assistente_atualizar_conversa_em_mensagem() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS assistente_mensagens_atualiza_conversa ON public.assistente_mensagens;
CREATE TRIGGER assistente_mensagens_atualiza_conversa
  AFTER INSERT ON public.assistente_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.assistente_atualizar_conversa_em_mensagem();

COMMENT ON TABLE public.assistente_conversas IS
  'Chats privados por usuario autenticado. Nenhum anexo binario e persistido.';
COMMENT ON TABLE public.assistente_mensagens IS
  'Textos das mensagens e nomes dos anexos; nao guarda arquivos nem conteudo extraido de PDFs.';

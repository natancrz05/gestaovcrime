CREATE TABLE public.sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('Problema','Sugestão')),
  descricao text NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'Não analisado' CHECK (status IN ('Não analisado','Em análise','Resolvido')),
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  usuario_nome text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes TO authenticated;
GRANT ALL ON public.sugestoes TO service_role;
ALTER TABLE public.sugestoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticado registra" ON public.sugestoes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND public.usuario_ativo(auth.uid()));
CREATE POLICY "Admin vê" ON public.sugestoes FOR SELECT TO authenticated USING (public.eh_admin(auth.uid()));
CREATE POLICY "Admin altera" ON public.sugestoes FOR UPDATE TO authenticated USING (public.eh_admin(auth.uid())) WITH CHECK (public.eh_admin(auth.uid()));
CREATE POLICY "Admin exclui" ON public.sugestoes FOR DELETE TO authenticated USING (public.eh_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.sugestoes_preparar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.usuario_id := auth.uid();
    NEW.usuario_nome := public.auditoria_nome(auth.uid());
    NEW.criado_em := now();
    NEW.status := 'Não analisado';
  ELSE
    NEW.usuario_id := OLD.usuario_id; NEW.usuario_nome := OLD.usuario_nome;
    NEW.criado_em := OLD.criado_em; NEW.tipo := OLD.tipo; NEW.descricao := OLD.descricao;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sugestoes_preparar BEFORE INSERT OR UPDATE ON public.sugestoes FOR EACH ROW EXECUTE FUNCTION public.sugestoes_preparar();

CREATE OR REPLACE FUNCTION public.auditoria_sugestoes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acao text; v_desc text; r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN v_acao := 'Criado'; v_desc := r.tipo || ' registrado(a)';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
    v_acao := 'Alteração de status'; v_desc := r.tipo || ' de ' || r.usuario_nome || ': ' || OLD.status || ' → ' || NEW.status;
  ELSE v_acao := 'Excluído'; v_desc := r.tipo || ' de ' || r.usuario_nome || ' excluído(a): ' || left(r.descricao, 100);
  END IF;
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), public.auditoria_nome(auth.uid()), v_acao, 'Problemas e Sugestões', r.id, NULL, '', v_desc);
  RETURN NULL;
END $$;
CREATE TRIGGER auditoria_sugestoes AFTER INSERT OR UPDATE OR DELETE ON public.sugestoes FOR EACH ROW EXECUTE FUNCTION public.auditoria_sugestoes();
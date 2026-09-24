CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  acao text NOT NULL CHECK (acao IN ('Criado','Editado','Excluído','Concluído','Alteração de status','Login','Logout','Login malsucedido')),
  modulo text NOT NULL,
  registro_id uuid,
  processo_id uuid,
  processo_numero text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT ''
);
CREATE INDEX auditoria_criado_em_idx ON public.auditoria (criado_em DESC);
CREATE INDEX auditoria_processo_idx ON public.auditoria (processo_id);
GRANT SELECT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
-- Admin vê tudo; usuários ativos veem o histórico ligado a processos (ficha do processo).
CREATE POLICY "Admin le toda a auditoria" ON public.auditoria FOR SELECT TO authenticated
  USING (public.eh_admin(auth.uid()));
CREATE POLICY "Usuarios ativos leem historico de processos" ON public.auditoria FOR SELECT TO authenticated
  USING (processo_id IS NOT NULL AND modulo <> 'Usuários' AND public.usuario_ativo(auth.uid()));
-- Sem políticas de INSERT/UPDATE/DELETE: somente o sistema (gatilhos/funções) grava.

CREATE OR REPLACE FUNCTION public.auditoria_nome(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT nome FROM public.usuarios WHERE id = _uid), '')
$$;
REVOKE EXECUTE ON FUNCTION public.auditoria_nome(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb; o jsonb; v_acao text; v_mod text; v_desc text; v_proc uuid; v_num text := '';
BEGIN
  IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN o := to_jsonb(OLD); END IF;
  v_acao := CASE TG_OP WHEN 'INSERT' THEN 'Criado' WHEN 'UPDATE' THEN 'Editado' ELSE 'Excluído' END;

  IF TG_TABLE_NAME = 'processos' THEN
    v_mod := 'Processos'; v_proc := (r->>'id')::uuid; v_num := r->>'numero';
    v_desc := 'Processo ' || lower(v_acao);
    IF TG_OP = 'UPDATE' AND o->>'status' IS DISTINCT FROM r->>'status' THEN
      v_acao := 'Alteração de status'; v_desc := 'Status do processo: ' || (o->>'status') || ' → ' || (r->>'status');
    END IF;
  ELSE
    v_proc := (r->>'processo_id')::uuid;
    SELECT numero INTO v_num FROM public.processos WHERE id = v_proc;
    IF TG_TABLE_NAME = 'reus' THEN
      v_mod := 'Réus'; v_desc := 'Réu ' || (r->>'nome') || ' ' || lower(v_acao);
      IF TG_OP = 'UPDATE' AND (o->>'preso' IS DISTINCT FROM r->>'preso' OR o->>'tipo_prisao' IS DISTINCT FROM r->>'tipo_prisao') THEN
        v_acao := 'Alteração de status'; v_desc := 'Situação prisional de ' || (r->>'nome') || ': ' || (o->>'tipo_prisao') || ' → ' || (r->>'tipo_prisao');
      END IF;
    ELSIF TG_TABLE_NAME = 'movimentacoes' THEN
      v_mod := 'Movimentações'; v_desc := 'Movimentação ' || lower(v_acao) || ': ' || left(r->>'descricao', 120);
    ELSIF TG_TABLE_NAME = 'audiencias' THEN
      v_mod := 'Audiências'; v_desc := 'Audiência (' || (r->>'tipo') || ' em ' || to_char((r->>'data')::date, 'DD/MM/YYYY') || ') ' || lower(v_acao);
      IF TG_OP = 'UPDATE' AND o->>'situacao' IS DISTINCT FROM r->>'situacao' THEN
        v_acao := 'Alteração de status'; v_desc := 'Audiência (' || (r->>'tipo') || '): ' || (o->>'situacao') || ' → ' || (r->>'situacao');
      END IF;
    ELSIF TG_TABLE_NAME = 'pendencias' THEN
      v_mod := 'Pendências'; v_desc := 'Pendência "' || COALESCE(NULLIF(r->>'titulo',''), left(r->>'descricao', 80)) || '" ' || replace(lower(v_acao), 'criado', 'criada');
      v_desc := replace(replace(v_desc, 'editado', 'editada'), 'excluído', 'excluída');
      IF TG_OP = 'UPDATE' AND o->>'status' IS DISTINCT FROM r->>'status' THEN
        IF r->>'status' = 'Concluída' THEN
          v_acao := 'Concluído'; v_desc := 'Pendência "' || COALESCE(NULLIF(r->>'titulo',''), left(r->>'descricao', 80)) || '" concluída';
        ELSE
          v_acao := 'Alteração de status'; v_desc := 'Pendência "' || COALESCE(NULLIF(r->>'titulo',''), left(r->>'descricao', 80)) || '": ' || (o->>'status') || ' → ' || (r->>'status');
        END IF;
      END IF;
    ELSIF TG_TABLE_NAME = 'prioridades' THEN
      v_mod := 'Prioridades'; v_desc := 'Prioridade manual "' || COALESCE(NULLIF(r->>'titulo',''), r->>'motivo') || '" ' || replace(replace(replace(lower(v_acao),'criado','criada'),'editado','editada'),'excluído','removida');
    END IF;
  END IF;

  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), public.auditoria_nome(auth.uid()), v_acao, v_mod, (r->>'id')::uuid, v_proc, COALESCE(v_num, ''), v_desc);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER auditoria_processos AFTER INSERT OR UPDATE OR DELETE ON public.processos FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_reus AFTER INSERT OR UPDATE OR DELETE ON public.reus FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_movimentacoes AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_audiencias AFTER INSERT OR UPDATE OR DELETE ON public.audiencias FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_pendencias AFTER INSERT OR UPDATE OR DELETE ON public.pendencias FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_prioridades AFTER INSERT OR UPDATE OR DELETE ON public.prioridades FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- Login/Logout do próprio usuário.
CREATE OR REPLACE FUNCTION public.registrar_acesso(_acao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR _acao NOT IN ('Login','Logout') THEN RAISE EXCEPTION 'Operação não permitida'; END IF;
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, modulo, descricao)
  VALUES (auth.uid(), public.auditoria_nome(auth.uid()), _acao, 'Acesso',
          CASE _acao WHEN 'Login' THEN 'Login realizado' ELSE 'Logout realizado' END);
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_acesso(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(text) TO authenticated;
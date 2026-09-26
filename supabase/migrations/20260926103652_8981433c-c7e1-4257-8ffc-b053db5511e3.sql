CREATE OR REPLACE FUNCTION public.auditoria_conferencia_reu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE num text;
BEGIN
  IF OLD.conferir IS NOT DISTINCT FROM NEW.conferir THEN RETURN NULL; END IF;
  SELECT numero INTO num FROM processos WHERE id = NEW.processo_id;
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
  VALUES (auth.uid(), public.auditoria_nome(auth.uid()), CASE WHEN NEW.conferir THEN 'Alteração de status' ELSE 'Concluído' END, 'Réus', NEW.id, NEW.processo_id, coalesce(num,''),
    CASE WHEN NEW.conferir THEN 'Conferência reaberta para ' || NEW.nome ELSE 'Conferência concluída: ' || NEW.nome END);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.auditoria_conferencia_reu() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER auditoria_conferencia_reu AFTER UPDATE OF conferir ON public.reus FOR EACH ROW EXECUTE FUNCTION public.auditoria_conferencia_reu();
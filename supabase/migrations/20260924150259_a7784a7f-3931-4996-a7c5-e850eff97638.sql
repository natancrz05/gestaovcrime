CREATE OR REPLACE FUNCTION public.auditoria_ajusta_genero() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.modulo IN ('Audiências','Movimentações') THEN
    NEW.descricao := regexp_replace(regexp_replace(regexp_replace(NEW.descricao, ' criado$', ' criada'), ' editado$', ' editada'), ' excluído$', ' excluída');
    NEW.descricao := regexp_replace(regexp_replace(NEW.descricao, '^(Movimentação) criado', '\1 criada'), '^(Movimentação) editado', '\1 editada');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.auditoria_ajusta_genero() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER auditoria_genero BEFORE INSERT ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.auditoria_ajusta_genero();
UPDATE public.auditoria SET descricao = regexp_replace(regexp_replace(descricao, ' criado$', ' criada'), ' excluído$', ' excluída') WHERE modulo = 'Audiências';
ALTER TABLE public.audiencias
  ADD COLUMN aguardando_nova_data boolean NOT NULL DEFAULT false,
  ADD COLUMN datas_anteriores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN ocultar_selo_reu_preso boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.audiencia_ajusta_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Saiu de "Realizada": limpa data efetiva (histórico fica na auditoria/movimentações).
  IF OLD.situacao = 'Realizada' AND NEW.situacao <> 'Realizada' THEN
    NEW.data_realizacao := NULL;
  END IF;
  IF NEW.situacao <> 'Redesignada' THEN NEW.aguardando_nova_data := false; END IF;
  -- Guarda datas anteriores quando data/horário mudam.
  IF OLD.data IS DISTINCT FROM NEW.data OR OLD.horario IS DISTINCT FROM NEW.horario THEN
    NEW.datas_anteriores := coalesce(OLD.datas_anteriores,'[]'::jsonb) || jsonb_build_object('data', OLD.data, 'horario', OLD.horario, 'situacao', OLD.situacao, 'alterado_em', now());
    NEW.aguardando_nova_data := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audiencia_ajusta_status BEFORE UPDATE ON public.audiencias
FOR EACH ROW EXECUTE FUNCTION public.audiencia_ajusta_status();
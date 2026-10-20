-- Defesa em profundidade: uma importação de pauta não pode reabrir
-- ou trocar automaticamente a situação de audiência já finalizada.
CREATE OR REPLACE FUNCTION public.audiencia_ajusta_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Importação nunca reabre nem troca automaticamente uma audiência já finalizada.
  -- O servidor ainda pode corrigir a situação manualmente fora do contexto de importação.
  IF current_setting('app.origem_operacao', true) = 'importacao'
     AND OLD.situacao IN ('Realizada', 'Cancelada', 'Não realizada', 'Convertida em diligência')
     AND NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    NEW.situacao := OLD.situacao;
    NEW.data_realizacao := OLD.data_realizacao;
    NEW.aguardando_nova_data := OLD.aguardando_nova_data;
  END IF;

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
END $function$;

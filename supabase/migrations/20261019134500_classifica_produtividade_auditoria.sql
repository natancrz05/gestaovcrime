-- Produtividade baseada na auditoria.
-- Critério conservador: só conta eventos cuja origem produtiva pode ser
-- identificada com segurança. Importações, automações e organização interna
-- permanecem auditadas, mas não entram no indicador principal.

ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'indefinida',
  ADD COLUMN IF NOT EXISTS conta_produtividade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categoria_produtividade text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS auditoria_produtividade_data_idx
  ON public.auditoria (conta_produtividade, criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_produtividade_usuario_data_idx
  ON public.auditoria (usuario_nome, conta_produtividade, criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_produtividade_categoria_data_idx
  ON public.auditoria (categoria_produtividade, conta_produtividade, criado_em DESC);

CREATE OR REPLACE FUNCTION public.classificar_auditoria_produtividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_processo text;
  v_observacao_audiencia text;
  v_dados_comparecimento jsonb;
  v_historico_oficio boolean;
BEGIN
  NEW.origem := 'indefinida';
  NEW.conta_produtividade := false;
  NEW.categoria_produtividade := '';

  IF NEW.modulo = 'Acesso' THEN
    NEW.origem := 'acesso';
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Importação'
     OR NEW.acao IN ('Importação', 'Importação desfeita') THEN
    NEW.origem := 'importacao';
    RETURN NEW;
  END IF;

  IF NEW.modulo IN ('Sistema', 'Problemas e Sugestões', 'Usuários') THEN
    NEW.origem := 'sistema';
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Prioridades' THEN
    NEW.origem := 'organizacao';
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Processos' THEN
    SELECT origem INTO v_origem_processo
      FROM public.processos
      WHERE id = NEW.registro_id;

    IF COALESCE(v_origem_processo, '') <> 'manual' THEN
      NEW.origem := 'importacao';
      RETURN NEW;
    END IF;

    NEW.origem := 'manual';

    -- Edição genérica de processo é deliberadamente excluída: hoje ela também
    -- pode resultar de rotinas automáticas. Cadastro manual e mudança de status
    -- são identificáveis com segurança.
    IF NEW.acao IN ('Criado', 'Alteração de status') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Processos';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Audiências' THEN
    SELECT observacao INTO v_observacao_audiencia
      FROM public.audiencias
      WHERE id = NEW.registro_id;

    IF COALESCE(v_observacao_audiencia, '') ILIKE '%Importada da pauta de audiências do PJe.%' THEN
      NEW.origem := 'importacao';
      RETURN NEW;
    END IF;

    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Audiências';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Comparecimentos' THEN
    -- Registro efetivo de comparecimento é sempre um ato produtivo.
    IF NEW.descricao ILIKE 'Comparecimento realizado:%' THEN
      NEW.origem := 'manual';
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Comparecimentos';
      RETURN NEW;
    END IF;

    SELECT dados_planilha INTO v_dados_comparecimento
      FROM public.comparecimentos
      WHERE id = NEW.registro_id;

    IF v_dados_comparecimento IS NOT NULL
       AND v_dados_comparecimento <> '{}'::jsonb THEN
      NEW.origem := 'importacao';
      RETURN NEW;
    END IF;

    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Comparecimentos';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Pendências' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Pendências';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Prisões' THEN
    NEW.origem := 'manual';
    IF NEW.acao IN ('Criado', 'Editado', 'Alteração de status', 'Concluído') THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Prisões';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Ofícios' THEN
    SELECT historico_importado INTO v_historico_oficio
      FROM public.controle_oficios
      WHERE id = NEW.registro_id;

    IF COALESCE(v_historico_oficio, false) THEN
      NEW.origem := 'importacao';
      RETURN NEW;
    END IF;

    NEW.origem := 'manual';
    IF NEW.acao = 'Criado' THEN
      NEW.conta_produtividade := true;
      NEW.categoria_produtividade := 'Ofícios';
    END IF;
    RETURN NEW;
  END IF;

  -- Movimentações e alterações genéricas de réus permanecem auditadas,
  -- mas não contam nesta primeira versão porque o histórico atual mistura
  -- lançamentos manuais e importações sem metadado suficiente para separá-los.
  IF NEW.modulo = 'Movimentações' THEN
    NEW.origem := 'indefinida';
    RETURN NEW;
  END IF;

  IF NEW.modulo = 'Réus' THEN
    NEW.origem := 'indefinida';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_classifica_produtividade ON public.auditoria;
CREATE TRIGGER auditoria_classifica_produtividade
BEFORE INSERT OR UPDATE ON public.auditoria
FOR EACH ROW
EXECUTE FUNCTION public.classificar_auditoria_produtividade();

-- Reclassifica o histórico existente sem apagar nem recriar logs.
UPDATE public.auditoria
SET origem = origem;

-- Reavaliações de prisão.
CREATE OR REPLACE FUNCTION public.auditoria_reu_reavaliacoes_produtividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_processo uuid;
  v_numero text;
BEGIN
  SELECT r.nome, r.processo_id, p.numero
    INTO v_nome, v_processo, v_numero
  FROM public.reus r
  LEFT JOIN public.processos p ON p.id = r.processo_id
  WHERE r.id = NEW.reu_id;

  INSERT INTO public.auditoria (
    criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
    processo_id, processo_numero, descricao
  )
  VALUES (
    NEW.criado_em, auth.uid(), COALESCE(NULLIF(NEW.usuario_nome, ''), public.auditoria_nome(auth.uid())),
    'Criado', 'Prisões', NEW.id, v_processo, COALESCE(v_numero, ''),
    'Reavaliação prisional registrada: ' || COALESCE(v_nome, 'réu') ||
    ' em ' || to_char(NEW.data_reavaliacao, 'DD/MM/YYYY')
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_reu_reavaliacoes_produtividade ON public.reu_reavaliacoes;
CREATE TRIGGER auditoria_reu_reavaliacoes_produtividade
AFTER INSERT ON public.reu_reavaliacoes
FOR EACH ROW EXECUTE FUNCTION public.auditoria_reu_reavaliacoes_produtividade();

-- Encerramento de situação prisional.
CREATE OR REPLACE FUNCTION public.auditoria_prisao_encerrada_produtividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_numero text;
BEGIN
  SELECT r.nome INTO v_nome FROM public.reus r WHERE r.id = NEW.reu_id;
  SELECT p.numero INTO v_numero FROM public.processos p WHERE p.id = NEW.processo_id;

  INSERT INTO public.auditoria (
    criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
    processo_id, processo_numero, descricao
  )
  VALUES (
    NEW.criado_em, auth.uid(), COALESCE(NULLIF(NEW.usuario_nome, ''), public.auditoria_nome(auth.uid())),
    'Concluído', 'Prisões', NEW.id, NEW.processo_id, COALESCE(v_numero, ''),
    'Situação prisional encerrada: ' || COALESCE(v_nome, 'réu') ||
    CASE WHEN COALESCE(NEW.motivo, '') <> '' THEN ' — ' || NEW.motivo ELSE '' END
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_prisao_encerrada_produtividade ON public.reu_prisoes_encerradas;
CREATE TRIGGER auditoria_prisao_encerrada_produtividade
AFTER INSERT ON public.reu_prisoes_encerradas
FOR EACH ROW EXECUTE FUNCTION public.auditoria_prisao_encerrada_produtividade();

-- Comparecimento efetivamente realizado.
CREATE OR REPLACE FUNCTION public.auditoria_comparecimento_registro_produtividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa text;
  v_numero text;
BEGIN
  SELECT c.pessoa INTO v_pessoa
  FROM public.comparecimentos c
  WHERE c.id = NEW.comparecimento_id;

  SELECT p.numero INTO v_numero
  FROM public.processos p
  WHERE p.id = NEW.processo_id;

  INSERT INTO public.auditoria (
    criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
    processo_id, processo_numero, descricao
  )
  VALUES (
    NEW.criado_em, auth.uid(), public.auditoria_nome(auth.uid()),
    'Concluído', 'Comparecimentos', NEW.id, NEW.processo_id, COALESCE(v_numero, ''),
    'Comparecimento realizado: ' || COALESCE(v_pessoa, 'pessoa') ||
    ' em ' || to_char(NEW.data_realizada, 'DD/MM/YYYY')
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_comparecimento_registro_produtividade ON public.comparecimento_registros;
CREATE TRIGGER auditoria_comparecimento_registro_produtividade
AFTER INSERT ON public.comparecimento_registros
FOR EACH ROW EXECUTE FUNCTION public.auditoria_comparecimento_registro_produtividade();

-- Ofícios gerados pelo sistema (histórico importado não entra).
CREATE OR REPLACE FUNCTION public.auditoria_oficios_produtividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero_processo text;
  v_numero_oficio text;
BEGIN
  IF COALESCE(NEW.historico_importado, false) THEN
    RETURN NULL;
  END IF;

  SELECT p.numero INTO v_numero_processo
  FROM public.processos p
  WHERE p.id = NEW.processo_id;

  v_numero_oficio := COALESCE(NEW.sequencial::text || '/' || NEW.ano::text, NEW.numero_original, 'sem número');

  INSERT INTO public.auditoria (
    criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
    processo_id, processo_numero, descricao
  )
  VALUES (
    NEW.criado_em, COALESCE(NEW.criado_por, auth.uid()),
    public.auditoria_nome(COALESCE(NEW.criado_por, auth.uid())),
    'Criado', 'Ofícios', NEW.id, NEW.processo_id, COALESCE(v_numero_processo, NEW.processo_original, ''),
    'Ofício ' || v_numero_oficio || ' gerado para ' || NEW.destinatario
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_oficios_produtividade ON public.controle_oficios;
CREATE TRIGGER auditoria_oficios_produtividade
AFTER INSERT ON public.controle_oficios
FOR EACH ROW EXECUTE FUNCTION public.auditoria_oficios_produtividade();

-- Retroatividade segura para atos que já existiam mas ainda não eram auditados.
INSERT INTO public.auditoria (
  criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
  processo_id, processo_numero, descricao
)
SELECT
  rr.criado_em, NULL, COALESCE(NULLIF(rr.usuario_nome, ''), 'Sistema'),
  'Criado', 'Prisões', rr.id, r.processo_id, COALESCE(p.numero, ''),
  'Reavaliação prisional registrada: ' || r.nome ||
  ' em ' || to_char(rr.data_reavaliacao, 'DD/MM/YYYY')
FROM public.reu_reavaliacoes rr
JOIN public.reus r ON r.id = rr.reu_id
LEFT JOIN public.processos p ON p.id = r.processo_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.auditoria a
  WHERE a.modulo = 'Prisões' AND a.registro_id = rr.id
);

INSERT INTO public.auditoria (
  criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
  processo_id, processo_numero, descricao
)
SELECT
  pe.criado_em, NULL, COALESCE(NULLIF(pe.usuario_nome, ''), 'Sistema'),
  'Concluído', 'Prisões', pe.id, pe.processo_id, COALESCE(p.numero, ''),
  'Situação prisional encerrada: ' || COALESCE(r.nome, 'réu') ||
  CASE WHEN COALESCE(pe.motivo, '') <> '' THEN ' — ' || pe.motivo ELSE '' END
FROM public.reu_prisoes_encerradas pe
LEFT JOIN public.reus r ON r.id = pe.reu_id
LEFT JOIN public.processos p ON p.id = pe.processo_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.auditoria a
  WHERE a.modulo = 'Prisões' AND a.registro_id = pe.id
);

INSERT INTO public.auditoria (
  criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
  processo_id, processo_numero, descricao
)
SELECT
  cr.criado_em, NULL, 'Sistema',
  'Concluído', 'Comparecimentos', cr.id, cr.processo_id, COALESCE(p.numero, ''),
  'Comparecimento realizado: ' || COALESCE(c.pessoa, 'pessoa') ||
  ' em ' || to_char(cr.data_realizada, 'DD/MM/YYYY')
FROM public.comparecimento_registros cr
LEFT JOIN public.comparecimentos c ON c.id = cr.comparecimento_id
LEFT JOIN public.processos p ON p.id = cr.processo_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.auditoria a
  WHERE a.modulo = 'Comparecimentos' AND a.registro_id = cr.id
    AND a.descricao ILIKE 'Comparecimento realizado:%'
);

INSERT INTO public.auditoria (
  criado_em, usuario_id, usuario_nome, acao, modulo, registro_id,
  processo_id, processo_numero, descricao
)
SELECT
  o.criado_em, o.criado_por, COALESCE(u.nome, 'Sistema'),
  'Criado', 'Ofícios', o.id, o.processo_id,
  COALESCE(p.numero, o.processo_original, ''),
  'Ofício ' || COALESCE(o.sequencial::text || '/' || o.ano::text, o.numero_original, 'sem número') ||
  ' gerado para ' || o.destinatario
FROM public.controle_oficios o
LEFT JOIN public.usuarios u ON u.id = o.criado_por
LEFT JOIN public.processos p ON p.id = o.processo_id
WHERE COALESCE(o.historico_importado, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.auditoria a
    WHERE a.modulo = 'Ofícios' AND a.registro_id = o.id
  );

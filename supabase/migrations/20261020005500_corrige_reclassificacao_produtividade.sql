-- A auditoria é append-only: a classificação deve acontecer na criação do log.
DROP TRIGGER IF EXISTS auditoria_classifica_produtividade ON public.auditoria;
CREATE TRIGGER auditoria_classifica_produtividade
BEFORE INSERT ON public.auditoria
FOR EACH ROW
EXECUTE FUNCTION public.classificar_auditoria_produtividade();

-- Reclassifica apenas Comparecimentos.
-- Logs gerados na mesma transação do resumo explícito de importação continuam técnicos.
UPDATE public.auditoria a
SET origem = CASE
      WHEN a.usuario_nome = 'Sistema' AND a.usuario_id IS NULL THEN 'indefinida'
      WHEN EXISTS (
        SELECT 1
        FROM public.auditoria i
        WHERE i.modulo = 'Comparecimentos'
          AND i.acao = 'Importação'
          AND i.usuario_nome = a.usuario_nome
          AND i.criado_em = a.criado_em
      ) THEN 'importacao'
      ELSE 'manual'
    END,
    conta_produtividade = CASE
      WHEN a.usuario_nome = 'Sistema' AND a.usuario_id IS NULL THEN false
      WHEN EXISTS (
        SELECT 1
        FROM public.auditoria i
        WHERE i.modulo = 'Comparecimentos'
          AND i.acao = 'Importação'
          AND i.usuario_nome = a.usuario_nome
          AND i.criado_em = a.criado_em
      ) THEN false
      ELSE a.acao IN ('Criado','Editado','Alteração de status','Concluído')
    END,
    categoria_produtividade = CASE
      WHEN a.usuario_nome = 'Sistema' AND a.usuario_id IS NULL THEN ''
      WHEN EXISTS (
        SELECT 1
        FROM public.auditoria i
        WHERE i.modulo = 'Comparecimentos'
          AND i.acao = 'Importação'
          AND i.usuario_nome = a.usuario_nome
          AND i.criado_em = a.criado_em
      ) THEN ''
      WHEN a.acao IN ('Criado','Editado','Alteração de status','Concluído') THEN 'Comparecimentos'
      ELSE ''
    END
WHERE a.modulo = 'Comparecimentos';
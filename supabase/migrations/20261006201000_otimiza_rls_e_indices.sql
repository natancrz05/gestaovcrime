-- Otimização de lançamento: evita reavaliar funções de sessão uma vez por linha
-- nas políticas RLS e completa índices para as ordenações usadas pelo frontend.
-- Não altera a matriz de permissões nem o conjunto de linhas autorizado.

-- Tabelas centrais: mesmas políticas, com funções sem dependência da linha
-- avaliadas como InitPlan pelo PostgreSQL.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'processos',
    'partes',
    'reus',
    'movimentacoes',
    'observacoes_internas',
    'audiencias',
    'pendencias',
    'prioridades'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "leitura por usuarios ativos" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "leitura por usuarios ativos" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.usuario_ativo(auth.uid())))',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS "cadastro por admin ou servidor" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "cadastro por admin ou servidor" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.pode_editar(auth.uid())))',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS "edicao por admin ou servidor" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "edicao por admin ou servidor" ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.pode_editar(auth.uid()))) WITH CHECK ((SELECT public.pode_editar(auth.uid())))',
      t
    );

    IF t = 'processos' THEN
      EXECUTE format('DROP POLICY IF EXISTS "exclusao somente admin" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "exclusao somente admin" ON public.%I FOR DELETE TO authenticated USING ((SELECT public.eh_admin(auth.uid())))',
        t
      );
    ELSE
      EXECUTE format('DROP POLICY IF EXISTS "exclusao por admin ou servidor" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "exclusao por admin ou servidor" ON public.%I FOR DELETE TO authenticated USING ((SELECT public.pode_editar(auth.uid())))',
        t
      );
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "usuario ve o proprio registro ou admin ve todos" ON public.usuarios;
CREATE POLICY "usuario ve o proprio registro ou admin ve todos"
  ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.eh_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "usuario ve o proprio perfil ou admin ve todos" ON public.user_roles;
CREATE POLICY "usuario ve o proprio perfil ou admin ve todos"
  ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.eh_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Administradores leem o registro de integracao" ON public.integracao_log;
CREATE POLICY "Administradores leem o registro de integracao"
  ON public.integracao_log
  FOR SELECT TO authenticated
  USING ((SELECT public.eh_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin le toda a auditoria" ON public.auditoria;
CREATE POLICY "Admin le toda a auditoria"
  ON public.auditoria
  FOR SELECT TO authenticated
  USING ((SELECT public.eh_admin(auth.uid())));

DROP POLICY IF EXISTS "Usuarios ativos leem historico de processos" ON public.auditoria;
CREATE POLICY "Usuarios ativos leem historico de processos"
  ON public.auditoria
  FOR SELECT TO authenticated
  USING (
    processo_id IS NOT NULL
    AND modulo <> 'Usuários'
    AND (SELECT public.usuario_ativo(auth.uid()))
  );

DROP POLICY IF EXISTS "admin ou servidor leem importacoes" ON public.importacoes;
CREATE POLICY "admin ou servidor leem importacoes"
  ON public.importacoes
  FOR SELECT TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "admin ou servidor leem itens" ON public.importacao_itens;
CREATE POLICY "admin ou servidor leem itens"
  ON public.importacao_itens
  FOR SELECT TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "leitura por usuarios ativos" ON public.comparecimentos;
CREATE POLICY "leitura por usuarios ativos"
  ON public.comparecimentos
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "cadastro por admin ou servidor" ON public.comparecimentos;
CREATE POLICY "cadastro por admin ou servidor"
  ON public.comparecimentos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "edicao por admin ou servidor" ON public.comparecimentos;
CREATE POLICY "edicao por admin ou servidor"
  ON public.comparecimentos
  FOR UPDATE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())))
  WITH CHECK ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "leitura por usuarios ativos" ON public.comparecimento_registros;
CREATE POLICY "leitura por usuarios ativos"
  ON public.comparecimento_registros
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "Usuarios ativos veem reavaliacoes" ON public.reu_reavaliacoes;
CREATE POLICY "Usuarios ativos veem reavaliacoes"
  ON public.reu_reavaliacoes
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "Usuarios ativos visualizam historico de prisoes" ON public.reu_prisoes_encerradas;
CREATE POLICY "Usuarios ativos visualizam historico de prisoes"
  ON public.reu_prisoes_encerradas
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "Autenticado registra" ON public.sugestoes;
CREATE POLICY "Autenticado registra"
  ON public.sugestoes
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND (SELECT public.usuario_ativo(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin vê" ON public.sugestoes;
CREATE POLICY "Admin vê"
  ON public.sugestoes
  FOR SELECT TO authenticated
  USING ((SELECT public.eh_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin altera" ON public.sugestoes;
CREATE POLICY "Admin altera"
  ON public.sugestoes
  FOR UPDATE TO authenticated
  USING ((SELECT public.eh_admin(auth.uid())))
  WITH CHECK ((SELECT public.eh_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin exclui" ON public.sugestoes;
CREATE POLICY "Admin exclui"
  ON public.sugestoes
  FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin(auth.uid())));

DROP POLICY IF EXISTS "leitura etiquetas por usuarios ativos" ON public.etiquetas;
CREATE POLICY "leitura etiquetas por usuarios ativos"
  ON public.etiquetas
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "cadastro etiquetas por admin ou servidor" ON public.etiquetas;
CREATE POLICY "cadastro etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.pode_editar(auth.uid()))
    AND criado_por = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "edicao etiquetas por admin ou servidor" ON public.etiquetas;
CREATE POLICY "edicao etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR UPDATE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())))
  WITH CHECK ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "exclusao etiquetas por admin ou servidor" ON public.etiquetas;
CREATE POLICY "exclusao etiquetas por admin ou servidor"
  ON public.etiquetas
  FOR DELETE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "leitura vinculos de etiquetas por usuarios ativos" ON public.processos_etiquetas;
CREATE POLICY "leitura vinculos de etiquetas por usuarios ativos"
  ON public.processos_etiquetas
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "vinculo etiquetas por admin ou servidor" ON public.processos_etiquetas;
CREATE POLICY "vinculo etiquetas por admin ou servidor"
  ON public.processos_etiquetas
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.pode_editar(auth.uid()))
    AND criado_por = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "desvinculo etiquetas por admin ou servidor" ON public.processos_etiquetas;
CREATE POLICY "desvinculo etiquetas por admin ou servidor"
  ON public.processos_etiquetas
  FOR DELETE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

DROP POLICY IF EXISTS "leitura alertas ocultos por usuarios ativos" ON public.alertas_ocultos;
CREATE POLICY "leitura alertas ocultos por usuarios ativos"
  ON public.alertas_ocultos
  FOR SELECT TO authenticated
  USING ((SELECT public.usuario_ativo(auth.uid())));

DROP POLICY IF EXISTS "ocultar alertas por admin ou servidor" ON public.alertas_ocultos;
CREATE POLICY "ocultar alertas por admin ou servidor"
  ON public.alertas_ocultos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.pode_editar(auth.uid()))
    AND criado_por = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "restaurar alertas por admin ou servidor" ON public.alertas_ocultos;
CREATE POLICY "restaurar alertas por admin ou servidor"
  ON public.alertas_ocultos
  FOR DELETE TO authenticated
  USING ((SELECT public.pode_editar(auth.uid())));

-- Completa os índices usados pelas ordenações atuais.
CREATE INDEX IF NOT EXISTS movimentacoes_processo_data_criado_idx
  ON public.movimentacoes (processo_id, data DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS comparecimento_registros_comparecimento_data_criado_idx
  ON public.comparecimento_registros (comparecimento_id, data_realizada DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS pendencias_criado_em_idx
  ON public.pendencias (criado_em DESC);

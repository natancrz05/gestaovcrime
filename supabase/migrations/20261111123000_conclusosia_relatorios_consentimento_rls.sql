-- Migração compatível tanto com instalação nova como com a versão anterior
-- da tabela de reuso. Relatórios legados ficam em quarentena (não compartilhados).
alter table public.calculos_ia_relatorios
  add column if not exists compartilhamento_autorizado boolean not null default false;

-- Não há prova verificável de consentimento para registros anteriores.
update public.calculos_ia_relatorios
  set compartilhamento_autorizado = false;

alter table public.calculos_ia_relatorios enable row level security;

drop policy if exists "calculos_relatorios_select_serventia" on public.calculos_ia_relatorios;
create policy "calculos_relatorios_select_serventia" on public.calculos_ia_relatorios
  for select to authenticated
  using (
    compartilhamento_autorizado = true
    and unidade = 'VARA_CORACAO_DE_MARIA_BA'
    and criado_em >= now() - interval '30 days'
    and exists (
      select 1 from public.usuarios u
      where u.id = (select auth.uid())
        and u.ativo = true and u.status_cadastro = 'aprovado'
    )
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('administrador', 'servidor')
    )
  );

drop policy if exists "calculos_relatorios_insert_serventia" on public.calculos_ia_relatorios;
create policy "calculos_relatorios_insert_serventia" on public.calculos_ia_relatorios
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and compartilhamento_autorizado = true
    and unidade = 'VARA_CORACAO_DE_MARIA_BA'
    and criado_em >= now() - interval '1 minute'
    and exists (
      select 1 from public.usuarios u
      where u.id = (select auth.uid())
        and u.ativo = true and u.status_cadastro = 'aprovado'
    )
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('administrador', 'servidor')
    )
  );

revoke all privileges on public.calculos_ia_relatorios from public, anon, authenticated;
grant select (id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, unidade, criado_em)
  on public.calculos_ia_relatorios to authenticated;
grant insert (autor_id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, compartilhamento_autorizado)
  on public.calculos_ia_relatorios to authenticated;

-- Sem políticas de UPDATE/DELETE: a publicação é imutável e não dá acesso a chats.

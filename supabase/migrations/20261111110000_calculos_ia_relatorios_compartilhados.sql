-- Relatórios reutilizáveis NÃO são conversas: sem conversa_id, mensagens, prompt ou PDF.
-- Escopo institucional: somente usuários ativos e aprovados com papel servidor/administrador.
create table if not exists public.calculos_ia_relatorios (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  processo_numero text not null check (
    processo_numero ~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
  ),
  tipo_analise text not null check (
    tipo_analise in ('prescricao', 'prisao_provisoria', 'manifestacoes', 'excesso', 'execucao', 'suspensao')
  ),
  modalidade_prisao text check (
    modalidade_prisao is null or modalidade_prisao in ('identificar', 'preventiva', 'temporaria', 'flagrante', 'outra')
  ),
  nome_reu text check (nome_reu is null or char_length(nome_reu) <= 160),
  data_referencia date not null,
  relatorio text not null check (char_length(relatorio) between 40 and 100000),
  compartilhamento_autorizado boolean not null default false check (compartilhamento_autorizado = true),
  unidade text not null default 'VARA_CORACAO_DE_MARIA_BA'
    check (unidade = 'VARA_CORACAO_DE_MARIA_BA'),
  criado_em timestamptz not null default now()
);
create index if not exists calculos_ia_relatorios_busca_idx
  on public.calculos_ia_relatorios (unidade, processo_numero, tipo_analise, criado_em desc);

alter table public.calculos_ia_relatorios enable row level security;
revoke all privileges on public.calculos_ia_relatorios from public, anon, authenticated;
grant select (id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, unidade, criado_em)
  on public.calculos_ia_relatorios to authenticated;
grant insert (autor_id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, compartilhamento_autorizado)
  on public.calculos_ia_relatorios to authenticated;

-- A política não permite acessar tabelas privadas de conversas de outros usuários.
-- Mesmo um usuário autenticado sem cadastro aprovado não pode ler relatórios.
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

-- Ausência de UPDATE/DELETE. A conversa original permanece na tabela privada
-- assistente_conversas/assistente_mensagens, com as políticas anteriores intactas.

create table if not exists public.calculos_ia_relatorios (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  processo_numero text not null check (processo_numero ~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'),
  tipo_analise text not null check (tipo_analise in ('prescricao','prisao_provisoria','manifestacoes','excesso','execucao','suspensao')),
  modalidade_prisao text check (modalidade_prisao is null or modalidade_prisao in ('identificar','preventiva','temporaria','flagrante','outra')),
  nome_reu text check (nome_reu is null or char_length(nome_reu) <= 160),
  data_referencia date not null,
  relatorio text not null check (char_length(relatorio) between 40 and 100000),
  compartilhamento_autorizado boolean not null default false check (compartilhamento_autorizado = true),
  unidade text not null default 'VARA_CORACAO_DE_MARIA_BA' check (unidade = 'VARA_CORACAO_DE_MARIA_BA'),
  criado_em timestamptz not null default now()
);
create index if not exists calculos_ia_relatorios_busca_idx on public.calculos_ia_relatorios (unidade, processo_numero, tipo_analise, criado_em desc);
revoke all privileges on public.calculos_ia_relatorios from public, anon, authenticated;
grant select (id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, unidade, criado_em) on public.calculos_ia_relatorios to authenticated;
grant insert (autor_id, processo_numero, tipo_analise, modalidade_prisao, nome_reu, data_referencia, relatorio, compartilhamento_autorizado) on public.calculos_ia_relatorios to authenticated;
grant all on public.calculos_ia_relatorios to service_role;
alter table public.calculos_ia_relatorios enable row level security;
drop policy if exists "calculos_relatorios_select_serventia" on public.calculos_ia_relatorios;
create policy "calculos_relatorios_select_serventia" on public.calculos_ia_relatorios for select to authenticated
using (compartilhamento_autorizado = true and unidade = 'VARA_CORACAO_DE_MARIA_BA' and criado_em >= now() - interval '30 days'
  and exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.ativo = true and u.status_cadastro = 'aprovado')
  and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('administrador','servidor')));
drop policy if exists "calculos_relatorios_insert_serventia" on public.calculos_ia_relatorios;
create policy "calculos_relatorios_insert_serventia" on public.calculos_ia_relatorios for insert to authenticated
with check (autor_id = (select auth.uid()) and compartilhamento_autorizado = true and unidade = 'VARA_CORACAO_DE_MARIA_BA' and criado_em >= now() - interval '1 minute'
  and exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.ativo = true and u.status_cadastro = 'aprovado')
  and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('administrador','servidor')));

alter table public.comparecimentos drop constraint if exists comparecimentos_situacao_check;
alter table public.comparecimentos add constraint comparecimentos_situacao_check check (situacao in ('Ativo','Encerrado','Desvinculado'));

create or replace function public.validar_registro_comparecimento_ativo()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.comparecimentos c where c.id = new.comparecimento_id and c.processo_id = new.processo_id and c.situacao = 'Ativo') then
    raise exception 'Vínculo processual inativo ou divergente. Não é possível registrar assinatura.' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke execute on function public.validar_registro_comparecimento_ativo() from public, anon, authenticated;
drop trigger if exists valida_vinculo_ativo_no_registro on public.comparecimento_registros;
create trigger valida_vinculo_ativo_no_registro before insert on public.comparecimento_registros for each row execute function public.validar_registro_comparecimento_ativo();

create or replace function public.proteger_processo_comparecimento_historico()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.processo_id is distinct from new.processo_id and exists (select 1 from public.comparecimento_registros r where r.comparecimento_id = old.id) then
    raise exception 'Há assinaturas no vínculo original. Crie outro vínculo sem reatribuir o histórico.' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke execute on function public.proteger_processo_comparecimento_historico() from public, anon, authenticated;
drop trigger if exists protege_processo_do_historico_comparecimento on public.comparecimentos;
create trigger protege_processo_do_historico_comparecimento before update of processo_id on public.comparecimentos for each row execute function public.proteger_processo_comparecimento_historico();

alter table public.comparecimento_registros add column if not exists assinatura_grupo_id uuid;
create index if not exists comparecimento_registros_assinatura_grupo_id_idx on public.comparecimento_registros (assinatura_grupo_id) where assinatura_grupo_id is not null;

create or replace function public.registrar_comparecimentos_multiplos(p_ids uuid[], p_data date, p_obs text, p_cpf text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_grupo uuid := gen_random_uuid();
  v_contagem integer := 0;
  v_processos uuid[] := array[]::uuid[];
  v_linha record;
  v_novo date;
  v_nome text := public.auditoria_nome(auth.uid());
  v_pessoa_comparavel text := null;
  v_nome_atual text;
begin
  if not public.pode_editar(auth.uid()) then raise exception 'Sem permissão para registrar comparecimentos'; end if;
  if p_data is null or p_data > current_date then raise exception 'Informe uma data de comparecimento válida, não futura'; end if;
  if length(v_cpf) <> 11 then raise exception 'Confirme os 11 dígitos do CPF da pessoa'; end if;
  if p_ids is null or cardinality(p_ids) < 2 or cardinality(p_ids) > 20 then raise exception 'Selecione entre 2 e 20 vínculos processuais'; end if;
  if (select count(distinct x) from unnest(p_ids) as x) <> cardinality(p_ids) then raise exception 'Há vínculos repetidos na seleção'; end if;
  for v_linha in
    select c.id, c.processo_id, c.proximo, c.intervalo_meses, c.pessoa, c.cpf, c.situacao, p.numero
      from public.comparecimentos c join public.processos p on p.id = c.processo_id
     where c.id = any(p_ids) order by c.id for update of c
  loop
    v_contagem := v_contagem + 1;
    if v_linha.situacao <> 'Ativo' then raise exception 'Todos os vínculos selecionados devem estar ativos'; end if;
    v_nome_atual := upper(regexp_replace(public.unaccent_safe(trim(v_linha.pessoa)), '[[:space:]]+', ' ', 'g'));
    if v_pessoa_comparavel is null then v_pessoa_comparavel := v_nome_atual;
    elsif v_nome_atual <> v_pessoa_comparavel then
      raise exception 'Os nomes nos vínculos diferem. Corrija a identidade antes de registrar uma assinatura conjunta.';
    end if;
    if v_linha.processo_id = any(v_processos) then
      raise exception 'A mesma pessoa não pode cumprir duas vezes a mesma obrigação processual neste evento';
    end if;
    v_processos := array_append(v_processos, v_linha.processo_id);
    if nullif(regexp_replace(coalesce(v_linha.cpf, ''), '[^0-9]', '', 'g'), '') is not null
       and regexp_replace(v_linha.cpf, '[^0-9]', '', 'g') <> v_cpf then
      raise exception 'CPF divergente entre os vínculos; não é seguro reunir as assinaturas';
    end if;
    if exists (select 1 from public.comparecimento_registros r where r.comparecimento_id = v_linha.id and r.data_realizada = p_data) then
      raise exception 'Já existe assinatura nesta data em um dos vínculos';
    end if;
    v_novo := (p_data + make_interval(months => v_linha.intervalo_meses))::date;
    insert into public.comparecimento_registros (comparecimento_id, processo_id, data_prevista, data_realizada, situacao, observacao, assinatura_grupo_id)
    values (v_linha.id, v_linha.processo_id, v_linha.proximo, p_data,
       case when p_data > v_linha.proximo then 'Realizado com atraso' else 'Realizado' end,
       left(coalesce(p_obs, ''), 1000), v_grupo);
    update public.comparecimentos set proximo = v_novo, cpf = v_cpf where id = v_linha.id;
    insert into public.auditoria (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id, processo_numero, descricao)
    values (auth.uid(), v_nome, 'Concluído', 'Comparecimentos', v_linha.id, v_linha.processo_id, coalesce(v_linha.numero, ''),
       'Assinatura conjunta de ' || v_linha.pessoa || ' em ' || to_char(p_data,'DD/MM/YYYY') || '; identificador ' || v_grupo::text);
  end loop;
  if v_contagem <> cardinality(p_ids) then raise exception 'Um ou mais vínculos não foram encontrados. Nada foi registrado.'; end if;
  return v_grupo;
end; $$;
revoke execute on function public.registrar_comparecimentos_multiplos(uuid[],date,text,text) from public, anon;
grant execute on function public.registrar_comparecimentos_multiplos(uuid[],date,text,text) to authenticated;
-- Comparecimentos: vínculo encerrado administrativamente, sem arquivar
-- o cadastro da pessoa nem reatribuir assinaturas de outro processo.
-- ATENÇÃO: aplicar no Supabase correspondente ao deploy antes de habilitar
-- o botão de desvincular.
alter table public.comparecimentos
  drop constraint if exists comparecimentos_situacao_check;
alter table public.comparecimentos
  add constraint comparecimentos_situacao_check
  check (situacao in ('Ativo', 'Encerrado', 'Desvinculado'));

comment on column public.comparecimentos.situacao is
  'Ativo = cautelar atual, Encerrado = obrigação finalizada, Desvinculado = vínculo anterior conservado para histórico e pendência de conferência, sem arquivar a pessoa.';

-- A proteção precisa estar no banco: a RPC registrar_comparecimento é
-- SECURITY DEFINER e não pode permitir registro em vínculo já removido.
create or replace function public.validar_registro_comparecimento_ativo()
returns trigger language plpgsql security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.comparecimentos c
    where c.id = new.comparecimento_id
      and c.processo_id = new.processo_id
      and c.situacao = 'Ativo'
  ) then
    raise exception 'Vínculo processual inativo ou divergente. Não é possível registrar assinatura.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.validar_registro_comparecimento_ativo()
  from public, anon, authenticated;

drop trigger if exists valida_vinculo_ativo_no_registro on public.comparecimento_registros;
create trigger valida_vinculo_ativo_no_registro
before insert on public.comparecimento_registros
for each row execute function public.validar_registro_comparecimento_ativo();

-- RLS pré-existente permanece. Nenhum DELETE, CASCADE ou migração de histórico.


-- Impede que uma alteração direta pela API do banco faça assinaturas antigas
-- parecerem pertencer a outro processo. Vale também fora da interface.
create or replace function public.proteger_processo_comparecimento_historico()
returns trigger language plpgsql security invoker
set search_path = public
as $$
begin
  if old.processo_id is distinct from new.processo_id
     and exists (
       select 1 from public.comparecimento_registros r
       where r.comparecimento_id = old.id
     ) then
    raise exception 'Há assinaturas no vínculo original. Crie outro vínculo sem reatribuir o histórico.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_processo_comparecimento_historico()
  from public, anon, authenticated;

drop trigger if exists protege_processo_do_historico_comparecimento on public.comparecimentos;
create trigger protege_processo_do_historico_comparecimento
before update of processo_id on public.comparecimentos
for each row execute function public.proteger_processo_comparecimento_historico();

-- Uma presença física pode produzir mais de um cumprimento processual.
-- O identificador compartilhado permite contar 1 presença e N obrigações.
alter table public.comparecimento_registros
  add column if not exists assinatura_grupo_id uuid;

create index if not exists comparecimento_registros_assinatura_grupo_id_idx
  on public.comparecimento_registros (assinatura_grupo_id)
  where assinatura_grupo_id is not null;

-- RPC transacional: se qualquer vínculo falhar, NENHUM registro é gravado.
-- Não altera o histórico da RPC individual já existente.
create or replace function public.registrar_comparecimentos_multiplos(
  p_ids uuid[], p_data date, p_obs text, p_cpf text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if not public.pode_editar(auth.uid()) then
    raise exception 'Sem permissão para registrar comparecimentos';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe uma data de comparecimento válida, não futura';
  end if;
  if length(v_cpf) <> 11 then
    raise exception 'Confirme os 11 dígitos do CPF da pessoa';
  end if;
  if p_ids is null or cardinality(p_ids) < 2 or cardinality(p_ids) > 20 then
    raise exception 'Selecione entre 2 e 20 vínculos processuais';
  end if;
  if (select count(distinct x) from unnest(p_ids) as x) <> cardinality(p_ids) then
    raise exception 'Há vínculos repetidos na seleção';
  end if;

  -- Ordem fixa de bloqueio evita deadlocks entre servidores concorrentes.
  for v_linha in
    select c.id, c.processo_id, c.proximo, c.intervalo_meses,
           c.pessoa, c.cpf, c.situacao, p.numero
      from public.comparecimentos c
      join public.processos p on p.id = c.processo_id
     where c.id = any(p_ids)
     order by c.id
     for update of c
  loop
    v_contagem := v_contagem + 1;
    if v_linha.situacao <> 'Ativo' then
      raise exception 'Todos os vínculos selecionados devem estar ativos';
    end if;
    -- CPF coincidente com nomes diferentes é pendência de conferência,
    -- não permissão automática para misturar os históricos.
    v_nome_atual := upper(regexp_replace(public.unaccent_safe(trim(v_linha.pessoa)), '[[:space:]]+', ' ', 'g'));
    if v_pessoa_comparavel is null then
      v_pessoa_comparavel := v_nome_atual;
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
    if exists (
      select 1 from public.comparecimento_registros r
      where r.comparecimento_id = v_linha.id and r.data_realizada = p_data
    ) then
      raise exception 'Já existe assinatura nesta data em um dos vínculos';
    end if;
    v_novo := (p_data + make_interval(months => v_linha.intervalo_meses))::date;
    insert into public.comparecimento_registros
      (comparecimento_id, processo_id, data_prevista, data_realizada, situacao,
       observacao, assinatura_grupo_id)
    values
      (v_linha.id, v_linha.processo_id, v_linha.proximo, p_data,
       case when p_data > v_linha.proximo then 'Realizado com atraso' else 'Realizado' end,
       left(coalesce(p_obs, ''), 1000), v_grupo);
    update public.comparecimentos
       set proximo = v_novo, cpf = v_cpf
     where id = v_linha.id;
    insert into public.auditoria
      (usuario_id, usuario_nome, acao, modulo, registro_id, processo_id,
       processo_numero, descricao)
    values
      (auth.uid(), v_nome, 'Concluído', 'Comparecimentos', v_linha.id,
       v_linha.processo_id, coalesce(v_linha.numero, ''),
       'Assinatura conjunta de ' || v_linha.pessoa ||
       ' em ' || to_char(p_data,'DD/MM/YYYY') || '; identificador ' || v_grupo::text);
  end loop;
  if v_contagem <> cardinality(p_ids) then
    raise exception 'Um ou mais vínculos não foram encontrados. Nada foi registrado.';
  end if;
  return v_grupo;
end;
$$;
revoke execute on function public.registrar_comparecimentos_multiplos(uuid[],date,text,text)
  from public, anon;
grant execute on function public.registrar_comparecimentos_multiplos(uuid[],date,text,text)
  to authenticated;

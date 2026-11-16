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

# Comparecimentos — uma pessoa, múltiplos vínculos processuais

## Regras de negócio
- Uma **pessoa** é agregada visualmente somente quando possui **CPF válido e coincidente**. Nomes iguais sem CPF não são fundidos.
- Cada **vínculo** continua sendo um registro próprio de comparecimento, com processo, periodicidade, vencimento, situação e histórico independentes.
- **Editar o processo:** alterações de dados e periodicidade são permitidas. Se o processo for alterado e já existirem assinaturas, a operação é recusada para impedir reatribuição de histórico; cadastre o novo vínculo.
- **Adicionar processo:** cria outro vínculo da mesma pessoa sem copiar assinaturas ou alterar o vencimento de outros processos. Não admite vínculo ativo duplicado do mesmo CPF/processo.
- **Remover vínculo:** muda apenas o estado do vínculo para `Desvinculado`, exige motivo da pendência, mantém `processo_id`, registros e auditoria. **Não arquiva o cadastro**. As obrigações desvinculadas deixam de gerar alerta de inadimplência e não recebem novas assinaturas.
- **Restaurar vínculo:** exige ação expressa e mantém selo `Conferir`; verificar decisão, periodicidade e vencimento antes de prosseguir.
- **Uma assinatura presencial para vários processos:** o servidor escolhe exatamente os vínculos atendidos. A RPC transacional atualiza todos ou nenhum, gera um único `assinatura_grupo_id`, cria registros separados e preserva o próximo vencimento conforme cada periodicidade. O CPF e os nomes precisam corresponder.
- **Certidão:** lista apenas os processos incluídos na assinatura. Uma assinatura física ≠ uma obrigação processual.

## Segurança e compatibilidade
- Mantém tabelas, linhas e IDs de `comparecimentos` existentes. Não exclui históricos nem reatribui registros.
- Mantém RLS existente. A nova RPC verifica `public.pode_editar(auth.uid())`, bloqueia CPF divergente, vínculos inativos e registros repetidos na mesma data.
- O banco recusa alteração de `processo_id` em cadastros com assinaturas anteriores.
- A lista de usuários sem CPF permanece separada para conferência manual.
- A implementação usa as mesmas rotas `/comparecimentos` e `/comparecimentos/encerrados`, com a seção adicional **Pendências de vínculo processual**.

## Pré-lançamento no Supabase correto
1. Confirmar o ambiente conectado ao deploy e fazer backup/snapshot.
2. Aplicar `supabase/migrations/20261116110000_comparecimentos_vinculo_desvinculado.sql` antes de habilitar a nova interface aos servidores.
3. Verificar a constraint de `situacao`, o trigger que protege histórico, a RPC `registrar_comparecimentos_multiplos` e seus privilégios.
4. Testar com dois processos fictícios e a mesma pessoa/CPF válido: assinatura conjunta cria **dois registros** com o mesmo `assinatura_grupo_id` e vencimentos distintos. Repetição na data ou CPF/nome divergente deve **reverter tudo**.
5. Testar desvinculação com pendência: não há arquivamento, não há alerta de atraso, nem nova assinatura; restauração requer conferência.
6. Testar perfis `consulta`, `servidor` e `administrador`, inclusive tentativa de chamada direta à RPC sem permissão de edição.
7. Conferir funcionamento dos cadastros legados, importações, página do processo e emissão da certidão.

**Sem migração aplicada e teste real de RLS/RPC no banco de produção, o recurso não pode ser considerado liberado.** O banco antigo rejeitará a situação `Desvinculado` e não reconhecerá a nova RPC. Nenhuma operação deve ser simulada como concluída.

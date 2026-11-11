# ConclusosIA — checklist de pré-lançamento

**Situação:** o código e os testes automatizados não substituem a validação do banco de produção. Liberação de relatórios institucionais depende dos itens abaixo.

## Segurança e privacidade — testes obrigatórios em ambiente autorizado

1. Confirmar que o **Supabase de produção** corresponde ao URL de configuração do deploy. Não copiar dados reais para um projeto desconhecido.
2. Aplicar e registrar as migrações, nesta ordem:
   - `20261111110000_calculos_ia_relatorios_compartilhados.sql`
   - `20261111123000_conclusosia_relatorios_consentimento_rls.sql`
3. Conferir RLS e privilégios efetivos da tabela `calculos_ia_relatorios`. Usuário anônimo, conta pendente, bloqueada ou de perfil `consulta` **não pode** ler ou gravar relatórios.
4. Com **duas contas de servidores aprovados** (A e B), fazer um teste com autos **fictícios e não sigilosos**: A registra relatório com compartilhamento autorizado; B consegue ler **somente o relatório final**. B não pode ler `assistente_conversas` e `assistente_mensagens` de A nem acessar IDs de conversas, anexos, prompts ou PDFs originais.
5. Desmarcar a opção de compartilhamento (padrão) e confirmar que B **não recebe** o relatório de A. PDFs truncados, sem texto, sem identificação inequívoca do processo/réu ou com sinalização de sigilo não podem ser compartilhados.
6. Simular análise com relatório anterior da mesma modalidade: abrir relatório anterior sem chamada à IA; exigir ação expressa para nova avaliação; nunca confundir processos, réus, modalidades de prisão ou datas de referência.
7. Verificar que relatórios anteriores à política de consentimento ficam **em quarentena** e não aparecem ao outro servidor.
8. Tentar consultas REST diretamente com IDs arbitrários: o servidor e a RLS devem devolver resultado vazio ou acesso negado, **nunca conversas de outro usuário**.
9. Confirmar que o histórico pessoal permanece visível apenas ao proprietário e mantém paginação de cinco relatórios.
10. Conferir que o PDF é enviado ao serviço de IA conforme a política institucional aplicável, com aviso ao servidor e revisão dos limites de dados sensíveis e confidenciais.
11. Em falha do banco: a tela **não** anuncia que conferiu o histórico institucional. Uma nova análise exige autorização explícita e fica no histórico privado.
12. Revisar exemplos jurídicos reais **sem dados pessoais de terceiros**: contagens CPC/CPP, temporária, preventiva, recesso, prorrogações e feriados locais, antes de confiar no vencimento calculado.

## Identidade do módulo

- Nome público: **ConclusosIA** (menu, página, chat e calculadora).
- Rota técnica mantida: `/assistente`.
- Funções e tabelas técnicas mantêm seus identificadores, evitando ruptura de históricos e integrações.

## Critério de aprovação

**NÃO LIBERAR o compartilhamento institucional nem declarar o lançamento validado** enquanto os itens 1–8 não estiverem documentados no Supabase de produção. Os testes automatizados confirmam o comportamento de código; não provam o resultado das políticas RLS no banco implantado.

## Plano de reversão

Desabilitar a publicação compartilhada na interface e no servidor, sem afetar o acesso às conversas privadas. Preservar histórico e dados existentes; não apagar tabelas ou políticas em produção sem análise do impacto e autorização.

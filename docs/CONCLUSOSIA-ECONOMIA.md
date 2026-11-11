# ConclusosIA — economia de créditos e apresentação dos limites

## Implementado

- **Respostas simples de escrita:** GPT-6 Luna apenas para pedidos curtos de correção gramatical, reescrita e formatação, sem anexo e sem conceitos jurídicos processuais complexos.
- **Análises jurídicas e autos:** GPT-6 Astra mantido para cálculos, documentos, jurisprudência, decisões e pedidos sensíveis. Não reduzir o modelo nessas atividades por economia isolada.
- **Contexto enviado:** até oito mensagens recentes, com teto de 12 mil caracteres nas mensagens anteriores; última solicitação preservada. O PDF anexado continua com seu próprio limite e não é reaproveitado entre usuários.
- **Pesquisa jurídica externa:** oferecida somente quando o servidor solicitar explicitamente; máximo de uma consulta LexML por resposta. Resultados de ferramentas não são salvos num cache compartilhado.
- **Resposta:** limite de 2.400 tokens no Luna; 7.200 no Astra, incluindo eventual raciocínio do modelo.
- **Avisos:** informar uma limitação real uma única vez e discretamente. Nunca omitir lacunas graves, proteção de dados, insuficiência documental ou divergências jurídicas.
- **Idempotência:** continua a reutilizar respostas com mesmo ID da conversa pessoal, sem cobrança repetida se o servidor reenviar uma solicitação já persistida.
- **Isolamento:** não colocar prompts, dados processuais, dados de usuários ou respostas em caches globais públicos.

## Alternativas avaliadas (não ativadas)

- **Gemini 3.8 Flash** ou **GPT-6 Sol:** modelos intermediários disponíveis no catálogo Lovable para tarefas menos complexas. Exigem teste comparativo de precisão e compatibilidade com chamadas de ferramentas antes de substituir o Astra.
- **GPT-6 Luna:** ativado somente para revisão textual simples. A economia por solicitação dependerá do volume de tokens e do consumo real.
- **API de modelo paga diretamente ao provedor:** pode mudar a conta pagadora, mas não implica automaticamente menor custo; requer chave em segredo do backend, contrato e avaliação da política institucional/LGPD.
- **Pré-triagem determinística do PDF:** pode reduzir o contexto em consultas futuras, mas cortar autos sem comprovar cobertura é arriscado para prescrição e custódia. Não aplicar a relatórios jurídicos sem validação.

## Medição recomendada

No painel **More → AI** do projeto Lovable, comparar total de créditos, modelo e tokens em sete dias antes e depois da mudança. Em **Workspace settings → Plans & credit usage → Usage details → Run credits**, observar o consumo por modelo e o número de chamadas. Custos efetivos dependem do workspace e do uso; a implementação **não representa garantia de percentual específico**.

Para autos reais, confirmar previamente configuração de retenção de contexto das chamadas de IA e a política de confidencialidade do órgão. Segundo as informações públicas da Lovable, o AI app context pode guardar conteúdo de requisição e resposta quando ativado.

## Referências

- https://docs.lovable.dev/features/ai-chat
- https://docs.lovable.dev/features/ai
- https://docs.lovable.dev/introduction/credits-and-usage

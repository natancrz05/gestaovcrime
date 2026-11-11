# ConclusosIA — uso econômico e verificações de segurança

## Em funcionamento

- **Redação simples:** modelo Luna, instruções curtas e sem anexos ou ferramentas desnecessárias.
- **Cálculos e análises jurídicas:** mantém Astra e as regras de precisão. Prazo processual aritmético deve usar cálculo determinístico.
- **Busca externa:** apenas mediante solicitação expressa, uma consulta LexML por resposta; não enviar dados pessoais ou autos.
- **Histórico:** contexto compacto apenas na solicitação atual, preservando a última pergunta integral. Nenhum cache de conversas compartilhado.
- **Ferramentas:** máximo de 4 rodadas da API, 8 execuções distintas e 14 mil caracteres por retorno; resultados parciais são identificados.
- **Avisos:** não repetir mensagens técnicas nem exibir dados internos de falhas; limitações materiais devem continuar sendo comunicadas uma vez.
- **Retentativa:** resposta já persistida pode ser recuperada pelo mesmo ID de mensagem, sem nova cobrança; o sistema não deve reenviar automaticamente diante de resultado inconclusivo.

## Alternativas avaliadas (ainda não implantadas)

| Alternativa | Potencial | Condição para ativação |
| --- | --- | --- |
| **GPT-6.1 Sol** em questões jurídicas intermediárias | Redução de custo em comparação ao Astra na API direta | Validar suporte, preço e qualidade no gateway Lovable; executar testes de precisão |
| **Pesquisa ementas oficiais por integração dedicada** | Menos respostas não confirmadas e menos tentativas do modelo | Definir serviços oficialmente disponíveis, contrato de uso, rate limits e sigilo |
| **Cache de legislação/jurisprudência PÚBLICA por termo** | Evitar chamadas repetidas por temas recorrentes | Não armazenar autos, nomes, CPF nem conversa; TTL e invalidade por atualização normativa |
| **Relatórios de uso por dia/modelo** | Entender onde os créditos são consumidos | Preferir métricas do provedor; coletar somente contagens, modelo e tokens, sem prompts |
| **Modelo mais barato apenas na classificação de tarefa** | Encaminhar tarefas simples com custo menor | Só ativar se a qualidade não afetar minutas e nenhuma fonte sigilosa for exposta |

**Custos de referência da API direta da OpenAI, por milhão de tokens (novembro/2026):** Luna: US$ 0,10 de entrada e US$ 0,50 de saída; Sol: US$ 2 de entrada e US$ 10 de saída; Astra: US$ 10 de entrada e US$ 50 de saída. **Esses valores não são o preço dos créditos da Lovable**: confirmar valor e suporte dos modelos no painel/provedor antes de comparar economia real.

## Liberação e acompanhamento

1. Verificar no deploy que o gateway Lovable aceita todos os modelos efetivamente selecionados e que o limite de saída não prejudica relatórios.
2. Testar uma minuta curta, uma consulta externa com referência válida, uma indisponível e um PDF complexo.
3. Comparar consumo de crédito no painel Lovable antes/depois, sem registrar dados processuais nos logs.
4. Monitorar respostas com retorno parcial, que devem sugerir consulta delimitada, não concluir sem elementos essenciais.
5. Não liberar compartilhamento institucional de relatórios sem executar/validar as migrações RLS no Supabase correto.

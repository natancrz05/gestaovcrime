
CREATE TABLE public.processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  classe text NOT NULL,
  assunto text NOT NULL DEFAULT '',
  comarca text NOT NULL DEFAULT 'Coração de Maria/BA',
  unidade text NOT NULL DEFAULT 'Vara Criminal',
  data_distribuicao date,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Suspenso','Arquivado','Baixado','Aguardando providência','Outro')),
  fase text NOT NULL DEFAULT '',
  observacao_geral text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.partes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Réu','Vítima','Ministério Público','Assistente de acusação','Defesa','Outro')),
  observacao text NOT NULL DEFAULT ''
);
CREATE TABLE public.reus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  situacao text NOT NULL DEFAULT '',
  preso boolean NOT NULL DEFAULT false,
  tipo_prisao text NOT NULL DEFAULT 'Não preso' CHECK (tipo_prisao IN ('Prisão preventiva','Prisão temporária','Prisão em flagrante','Outra','Não preso')),
  data_prisao date,
  observacoes text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0
);
CREATE TABLE public.movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'Outro' CHECK (tipo IN ('Despacho','Decisão','Sentença','Petição','Manifestação','Intimação','Certidão','Audiência','Mandado','Carta precatória','Juntada','Outro')),
  observacao text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.observacoes_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audiencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  situacao text NOT NULL DEFAULT 'Designada'
);
CREATE TABLE public.pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  prazo date,
  concluida boolean NOT NULL DEFAULT false
);
CREATE TABLE public.prioridades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['processos','partes','reus','movimentacoes','observacoes_internas','audiencias','pendencias','prioridades'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Provisório: acesso aberto até a etapa de autenticação
    EXECUTE format('CREATE POLICY "acesso provisorio" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

INSERT INTO public.processos (id, numero, classe, assunto, data_distribuicao, status, fase, responsavel, observacao_geral) VALUES
('00000000-0000-0000-0000-000000000001','0000101-45.2026.8.05.0000','Ação Penal - Procedimento Ordinário','Roubo majorado','2026-02-10','Ativo','Instrução','Servidor A','Processo fictício com réu preso.'),
('00000000-0000-0000-0000-000000000002','0000102-12.2026.8.05.0000','Inquérito Policial','Homicídio qualificado','2026-08-20','Ativo','Investigação','Servidor B','Processo fictício com prisão temporária.'),
('00000000-0000-0000-0000-000000000003','0000103-78.2025.8.05.0000','Ação Penal - Procedimento Ordinário','Tráfico de drogas','2025-11-03','Ativo','Instrução','Servidor A','Processo fictício com vários réus.'),
('00000000-0000-0000-0000-000000000004','0000104-33.2024.8.05.0000','Ação Penal - Procedimento Sumário','Lesão corporal','2024-06-15','Aguardando providência','Citação','Servidor C','Processo fictício sem movimentação recente.'),
('00000000-0000-0000-0000-000000000005','0000105-90.2026.8.05.0000','Ação Penal - Procedimento Sumaríssimo','Ameaça','2026-05-02','Ativo','Alegações finais','Servidor B','Processo fictício recentemente movimentado.'),
('00000000-0000-0000-0000-000000000006','0000106-21.2025.8.05.0000','Ação Penal - Júri','Tentativa de homicídio','2025-09-12','Ativo','Pronúncia','Servidor C','Processo fictício com audiência futura.'),
('00000000-0000-0000-0000-000000000007','0000107-54.2026.8.05.0000','Execução Penal','Furto qualificado','2026-01-20','Ativo','Execução','Servidor A','Processo fictício com pendência.'),
('00000000-0000-0000-0000-000000000008','0000108-66.2023.8.05.0000','Ação Penal - Procedimento Ordinário','Estelionato','2023-03-08','Suspenso','Suspensão condicional','Servidor B','Processo fictício sem prioridade.');

INSERT INTO public.reus (processo_id, nome, situacao, preso, tipo_prisao, data_prisao, ordem) VALUES
('00000000-0000-0000-0000-000000000001','Réu Fictício Alfa','Custodiado',true,'Prisão preventiva','2026-02-05',0),
('00000000-0000-0000-0000-000000000002','Investigado Fictício Beta','Custodiado',true,'Prisão temporária','2026-09-15',0),
('00000000-0000-0000-0000-000000000003','Réu Fictício Gama','Custodiado',true,'Prisão preventiva','2025-10-30',0),
('00000000-0000-0000-0000-000000000003','Réu Fictício Delta','Solto',false,'Não preso',NULL,1),
('00000000-0000-0000-0000-000000000003','Réu Fictício Épsilon','Solto',false,'Não preso',NULL,2),
('00000000-0000-0000-0000-000000000004','Réu Fictício Zeta','Não localizado',false,'Não preso',NULL,0),
('00000000-0000-0000-0000-000000000005','Réu Fictício Eta','Solto',false,'Não preso',NULL,0),
('00000000-0000-0000-0000-000000000006','Réu Fictício Teta','Solto',false,'Não preso',NULL,0),
('00000000-0000-0000-0000-000000000007','Apenado Fictício Iota','Regime semiaberto',false,'Não preso',NULL,0),
('00000000-0000-0000-0000-000000000008','Réu Fictício Kapa','Solto',false,'Não preso',NULL,0);

INSERT INTO public.partes (processo_id, nome, tipo) VALUES
('00000000-0000-0000-0000-000000000001','Ministério Público do Estado','Ministério Público'),
('00000000-0000-0000-0000-000000000001','Vítima Fictícia 1','Vítima'),
('00000000-0000-0000-0000-000000000001','Defensoria Fictícia','Defesa'),
('00000000-0000-0000-0000-000000000002','Vítima Fictícia 2','Vítima'),
('00000000-0000-0000-0000-000000000003','Ministério Público do Estado','Ministério Público'),
('00000000-0000-0000-0000-000000000003','Advogado Fictício X','Defesa'),
('00000000-0000-0000-0000-000000000004','Vítima Fictícia 3','Vítima'),
('00000000-0000-0000-0000-000000000005','Vítima Fictícia 4','Vítima'),
('00000000-0000-0000-0000-000000000006','Vítima Fictícia 5','Vítima'),
('00000000-0000-0000-0000-000000000006','Assistente Fictício Y','Assistente de acusação'),
('00000000-0000-0000-0000-000000000008','Vítima Fictícia 6','Vítima');

INSERT INTO public.movimentacoes (processo_id, data, descricao, tipo) VALUES
('00000000-0000-0000-0000-000000000001','2026-02-12','Recebimento da denúncia','Decisão'),
('00000000-0000-0000-0000-000000000001','2026-09-01','Juntada de resposta à acusação','Juntada'),
('00000000-0000-0000-0000-000000000002','2026-09-16','Decretação de prisão temporária','Decisão'),
('00000000-0000-0000-0000-000000000003','2026-03-10','Expedição de carta precatória','Carta precatória'),
('00000000-0000-0000-0000-000000000003','2026-06-01','Certidão de cumprimento parcial','Certidão'),
('00000000-0000-0000-0000-000000000004','2025-12-10','Expedição de mandado de citação','Mandado'),
('00000000-0000-0000-0000-000000000005','2026-09-22','Manifestação do Ministério Público','Manifestação'),
('00000000-0000-0000-0000-000000000006','2026-07-15','Despacho designando audiência','Despacho'),
('00000000-0000-0000-0000-000000000007','2026-08-05','Intimação do apenado','Intimação'),
('00000000-0000-0000-0000-000000000008','2026-04-18','Certidão de comparecimento','Certidão');

INSERT INTO public.audiencias (processo_id, data, tipo, local) VALUES
('00000000-0000-0000-0000-000000000001','2026-10-08','Instrução e julgamento','Sala de audiências'),
('00000000-0000-0000-0000-000000000006','2026-11-19','Sessão do Júri','Plenário'),
('00000000-0000-0000-0000-000000000003','2027-05-12','Continuação da instrução','Sala de audiências');

INSERT INTO public.pendencias (processo_id, descricao, prazo) VALUES
('00000000-0000-0000-0000-000000000007','Conferir cálculo de pena','2026-09-30'),
('00000000-0000-0000-0000-000000000004','Verificar retorno do mandado de citação',NULL);

INSERT INTO public.observacoes_internas (processo_id, texto) VALUES
('00000000-0000-0000-0000-000000000003','Processo aguardando retorno de carta precatória.'),
('00000000-0000-0000-0000-000000000004','Verificar cumprimento de mandado.'),
('00000000-0000-0000-0000-000000000006','Conferir situação da audiência.');

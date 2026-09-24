ALTER TABLE public.audiencias
  ADD COLUMN horario time,
  ADD COLUMN modalidade text NOT NULL DEFAULT 'Presencial' CHECK (modalidade IN ('Presencial','Virtual','Híbrida')),
  ADD COLUMN observacao text NOT NULL DEFAULT '',
  ADD COLUMN criado_em timestamptz NOT NULL DEFAULT now();

DELETE FROM public.audiencias WHERE processo_id IN (
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000006');

INSERT INTO public.audiencias (processo_id, data, horario, tipo, modalidade, local, situacao, observacao) VALUES
('00000000-0000-0000-0000-000000000001','2026-09-24','14:00','Instrução','Presencial','Sala de audiências 1','Designada','Réu preso — requisitar escolta (fictício).'),
('00000000-0000-0000-0000-000000000005','2026-09-29','09:30','Oitiva','Virtual','Sala virtual','Designada',''),
('00000000-0000-0000-0000-000000000003','2026-10-15','10:00','Continuação','Híbrida','Sala de audiências 1','Designada','Aguardando retorno de carta precatória.'),
('00000000-0000-0000-0000-000000000006','2026-11-19','08:30','Tribunal do Júri','Presencial','Plenário do Júri','Designada',''),
('00000000-0000-0000-0000-000000000008','2027-02-19','11:00','Instrução','Presencial','Sala de audiências 2','Designada','');
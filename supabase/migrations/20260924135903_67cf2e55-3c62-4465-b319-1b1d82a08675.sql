ALTER TABLE public.pendencias
  ADD COLUMN titulo text NOT NULL DEFAULT '',
  ADD COLUMN tipo text NOT NULL DEFAULT 'Outros',
  ADD COLUMN prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  ADD COLUMN status text NOT NULL DEFAULT 'A fazer' CHECK (status IN ('A fazer','Em andamento','Aguardando','Concluída')),
  ADD COLUMN responsavel text NOT NULL DEFAULT '',
  ADD COLUMN observacoes text NOT NULL DEFAULT '',
  ADD COLUMN criado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN data_conclusao date;
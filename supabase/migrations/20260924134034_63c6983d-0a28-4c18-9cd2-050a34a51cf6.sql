ALTER TABLE public.prioridades
  ALTER COLUMN motivo SET DEFAULT '',
  ADD COLUMN titulo text NOT NULL DEFAULT '',
  ADD COLUMN nivel text NOT NULL DEFAULT 'media' CHECK (nivel IN ('alta','media','baixa')),
  ADD COLUMN observacao text NOT NULL DEFAULT '';

UPDATE public.prioridades SET titulo = motivo WHERE titulo = '';

INSERT INTO public.prioridades (processo_id, titulo, nivel, observacao) VALUES
('00000000-0000-0000-0000-000000000007','Acompanhar cálculo de pena','alta','Anotação fictícia de gestão.'),
('00000000-0000-0000-0000-000000000001','Conferir intimação das testemunhas','media','');
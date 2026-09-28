-- Reconstitui os vínculos de processos dos réus presos a partir dos números CNJ presentes na planilha oficial.
-- Não cria processos novos. Quando o processo já existe, grava o vínculo; quando não existe, preserva o número como não vinculado.
DO $$
DECLARE
  f record;
  alvo record;
  total_rji integer;
  rel jsonb;
  principal uuid;
BEGIN
  FOR f IN
    SELECT * FROM jsonb_to_recordset('[{"rji":"267318536-10","relacoes":[{"tipo":"cautelar","numero":"8000640-34.2026.8.05.0067"},{"tipo":"ip","numero":"8000640-34.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000941-78.2026.8.05.0067"}]},{"rji":"235064650-80","relacoes":[{"tipo":"acao_penal","numero":"8000224-71.2023.8.05.0067"}]},{"rji":"256767552-24","relacoes":[{"tipo":"cautelar","numero":"8001400-17.2025.8.05.0067"},{"tipo":"ip","numero":"8001424-45.2025.8.05.0067"},{"tipo":"acao_penal","numero":"8001453-95.2025.8.05.0067"}]},{"rji":"256360677-18","relacoes":[{"tipo":"cautelar","numero":"8000973-20.2025.8.05.0067"},{"tipo":"acao_penal","numero":"8000803-48.2025.8.05.0067"}]},{"rji":"267486214-66","relacoes":[{"tipo":"cautelar","numero":"8000892-37.2026.8.05.0067"},{"tipo":"ip","numero":"8000946-03.2026.8.05.0067"}]},{"rji":"256950489-02","relacoes":[{"tipo":"cautelar","numero":"8001730-14.2025.8.05.0067"},{"tipo":"ip","numero":"8000037-58.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000053-12.2026.8.05.0067"}]},{"rji":"267084933-19","relacoes":[{"tipo":"cautelar","numero":"8000759-92.2026.8.05.0067"},{"tipo":"ip","numero":"8000233-28.2026.8.05.0067"},{"tipo":"ip","numero":"8000318-14.2026.8.05.0067"},{"tipo":"ip","numero":"8000319-96.2026.8.05.0067"}]},{"rji":"267053881-66","relacoes":[{"tipo":"cautelar","numero":"8000001-16.2026.8.05.0067"},{"tipo":"ip","numero":"8000114-67.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000715-73.2026.8.05.0067"}]},{"rji":"267253658-62","relacoes":[{"tipo":"cautelar","numero":"8000369-25.2026.8.05.0067"},{"tipo":"ip","numero":"8000992-89.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8001195-51.2026.8.05.0067"}]},{"rji":"224644573-00","relacoes":[{"tipo":"acao_penal","numero":"8000425-97.2022.8.05.0067"}]},{"rji":"180808279-00","relacoes":[{"tipo":"cautelar","numero":"8000914-95.2026.8.05.0067"},{"tipo":"ip","numero":"8000916-65.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000934-86.2026.8.05.0067"}]},{"rji":"267366370-01","relacoes":[{"tipo":"cautelar","numero":"8000612-66.2026.8.05.0067"},{"tipo":"ip","numero":"8000888-97.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8001053-47.2026.8.05.0067"}]},{"rji":"267617675-41","relacoes":[{"tipo":"cautelar","numero":"8001179-97.2026.8.05.0067"}]},{"rji":"256310816-07","relacoes":[{"tipo":"cautelar","numero":"8000488-20.2025.8.05.0067"},{"tipo":"ip","numero":"8000918-69.2025.8.05.0067"}]},{"rji":"180965441-04","relacoes":[]},{"rji":"267509100-38","relacoes":[{"tipo":"cautelar","numero":"8000877-68.2026.8.05.0067"},{"tipo":"ip","numero":"8000948-70.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8001118-42.2026.8.05.0067"}]},{"rji":"180889609-78","relacoes":[{"tipo":"acao_penal","numero":"0000167-05.2017.8.05.0067"}]},{"rji":"267462482-29","relacoes":[]},{"rji":"256310402-42","relacoes":[{"tipo":"cautelar","numero":"8000488-20.2025.8.05.0067"},{"tipo":"ip","numero":"8000918-69.2025.8.05.0067"}]},{"rji":"267328989-27","relacoes":[{"tipo":"ip","numero":"8000209-97.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000944-33.2026.8.05.0067"}]},{"rji":"256936972-02","relacoes":[{"tipo":"cautelar","numero":"8000957-32.2026.8.05.0067"}]},{"rji":"267656580-70","relacoes":[{"tipo":"cautelar","numero":"8001179-97.2026.8.05.0067"}]},{"rji":"256934070-69","relacoes":[{"tipo":"cautelar","numero":"8003197-96.2025.8.05.0109"},{"tipo":"ip","numero":"8001794-24.2025.8.05.0067"},{"tipo":"acao_penal","numero":"8000028-96.2026.8.05.0067"}]},{"rji":"245527471-49","relacoes":[{"tipo":"cautelar","numero":"8001413-50.2026.8.05.0109"},{"tipo":"ip","numero":"8000712-21.2026.8.05.0067"}]},{"rji":"267716671-08","relacoes":[{"tipo":"cautelar","numero":"8001204-13.2026.8.05.0067"}]},{"rji":"256484313-04","relacoes":[{"tipo":"cautelar","numero":"8000810-40.2025.8.05.0067"},{"tipo":"ip","numero":"8000568-18.2024.8.05.0067"},{"tipo":"acao_penal","numero":"8000893-56.2025.8.05.0067"}]},{"rji":"256950470-94","relacoes":[{"tipo":"cautelar","numero":"8001730-14.2025.8.05.0067"},{"tipo":"ip","numero":"8000037-58.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000053-12.2026.8.05.0067"}]},{"rji":"256950470-94","relacoes":[{"tipo":"cautelar","numero":"8001815-97.2025.8.05.0067"},{"tipo":"cautelar","numero":"8001528-37.2025.8.05.0067"},{"tipo":"ip","numero":"8000038-43.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000054-94.2026.8.05.0067"}]},{"rji":"256778753-39","relacoes":[{"tipo":"cautelar","numero":"8001400-17.2025.8.05.0067"},{"tipo":"ip","numero":"8001424-45.2025.8.05.0067"},{"tipo":"acao_penal","numero":"8001453-95.2025.8.05.0067"}]},{"rji":"224644616-85","relacoes":[{"tipo":"acao_penal","numero":"8000425-97.2022.8.05.0067"}]},{"rji":"267187016-40","relacoes":[{"tipo":"cautelar","numero":"8006605-51.2026.8.05.0080"},{"tipo":"cautelar","numero":"8009402-97.2026.8.05.0080"},{"tipo":"ip","numero":"8000385-76.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000520-88.2026.8.05.0067"}]},{"rji":"256556799-44","relacoes":[{"tipo":"cautelar","numero":"8000909-10.2025.8.05.0067"},{"tipo":"acao_penal","numero":"8001145-59.2025.8.05.0067"}]},{"rji":"267462147-58","relacoes":[{"tipo":"acao_penal","numero":"8000969-46.2026.8.05.0067"}]},{"rji":"256896169-37","relacoes":[{"tipo":"cautelar","numero":"8001815-97.2025.8.05.0067"},{"tipo":"cautelar","numero":"8001528-37.2025.8.05.0067"},{"tipo":"ip","numero":"8000038-43.2026.8.05.0067"},{"tipo":"acao_penal","numero":"8000054-94.2026.8.05.0067"}]},{"rji":"256310776-77","relacoes":[{"tipo":"cautelar","numero":"8000488-20.2025.8.05.0067"},{"tipo":"ip","numero":"8000918-69.2025.8.05.0067"}]}]'::jsonb)
    AS x(rji text, relacoes jsonb)
  LOOP
    SELECT count(*) INTO total_rji
      FROM public.reus r
     WHERE regexp_replace(COALESCE(r.rji, ''), '\s', '', 'g') = f.rji;

    FOR alvo IN
      SELECT r.id
        FROM public.reus r
       WHERE regexp_replace(COALESCE(r.rji, ''), '\s', '', 'g') = f.rji
         AND (
           total_rji = 1
           OR EXISTS (
             SELECT 1
               FROM jsonb_array_elements(f.relacoes) x
              WHERE regexp_replace(COALESCE(r.processos_relacionados::text, ''), '\D', '', 'g')
                    LIKE '%' || regexp_replace(x->>'numero', '\D', '', 'g') || '%'
           )
         )
    LOOP
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'tipo', x->>'tipo',
          'numero', x->>'numero',
          'processo_id', p.id,
          'situacao', CASE WHEN p.id IS NULL THEN 'nao_vinculado' ELSE 'encontrado' END
        ) ORDER BY x->>'tipo', x->>'numero'
      ), '[]'::jsonb)
      INTO rel
      FROM jsonb_array_elements(f.relacoes) x
      LEFT JOIN public.processos p
        ON regexp_replace(COALESCE(p.numero, ''), '\D', '', 'g') = regexp_replace(x->>'numero', '\D', '', 'g');

      SELECT p.id INTO principal
        FROM jsonb_array_elements(f.relacoes) x
        JOIN public.processos p
          ON regexp_replace(COALESCE(p.numero, ''), '\D', '', 'g') = regexp_replace(x->>'numero', '\D', '', 'g')
       ORDER BY CASE x->>'tipo' WHEN 'cautelar' THEN 1 WHEN 'ip' THEN 2 WHEN 'acao_penal' THEN 3 ELSE 4 END, x->>'numero'
       LIMIT 1;

      UPDATE public.reus
         SET processos_relacionados = rel,
             processo_id = principal
       WHERE id = alvo.id;
    END LOOP;
  END LOOP;
END $$;

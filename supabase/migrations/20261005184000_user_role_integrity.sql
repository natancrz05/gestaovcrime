-- O sistema trabalha com um único perfil efetivo por usuário.
-- Se houver legado com múltiplos perfis, preserva o de maior privilégio
-- já adotado pela regra de sessão (administrador > servidor > consulta).
WITH ranqueados AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY CASE role
        WHEN 'administrador' THEN 1
        WHEN 'servidor' THEN 2
        ELSE 3
      END, id
    ) AS ordem
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranqueados WHERE ordem > 1);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_uidx
  ON public.user_roles (user_id);

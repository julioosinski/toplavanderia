-- Novo perfil "gerente" (manager). Precisa ficar em migration própria:
-- o valor novo do enum não pode ser usado na mesma transação em que foi criado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

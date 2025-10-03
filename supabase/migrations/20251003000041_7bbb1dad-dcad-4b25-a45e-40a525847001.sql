-- Remover role de admin do usuário julio@teste.com, mantendo apenas super_admin
DELETE FROM public.user_roles 
WHERE user_id = '40aed2bd-9005-4d72-bf95-7c7b8370c923' 
  AND role = 'admin';
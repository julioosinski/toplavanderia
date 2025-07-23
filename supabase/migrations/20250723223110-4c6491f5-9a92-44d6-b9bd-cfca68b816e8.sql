-- Atualizar o usuário existente para admin
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = '40aed2bd-9005-4d72-bf95-7c7b8370c923';
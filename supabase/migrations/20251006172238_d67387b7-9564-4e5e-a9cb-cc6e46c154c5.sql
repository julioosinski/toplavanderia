-- Adicionar role para o usuário julio@teste2.com que foi criado sem role
INSERT INTO public.user_roles (user_id, role, laundry_id)
VALUES ('1c95a8fd-6fea-4e8b-a6dc-12d0c5f41fcf', 'operator', '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569')
ON CONFLICT DO NOTHING;
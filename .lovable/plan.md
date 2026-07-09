## Problema identificado

A tela está carregando corretamente e a chamada para `machines` está sendo feita, mas o Supabase retorna `[]` para o usuário atual na lavanderia `TOP LAVANDERIA SINUELO`.

O usuário tem dois papéis:

- `operator` na lavanderia que possui as máquinas (`TOP LAVANDERIA SINUELO`)
- `admin` em outra lavanderia

A política atual de RLS usa `get_user_laundry_id(auth.uid())`, que pega apenas uma lavanderia do usuário. Quando o usuário possui mais de um papel/lavanderia, essa função pode retornar a lavanderia errada e bloquear as máquinas da lavanderia correta.

## Plano de correção

1. Ajustar as políticas RLS de `machines` para validar acesso por qualquer papel do usuário na lavanderia da máquina, não apenas pela primeira lavanderia retornada por `get_user_laundry_id`.

2. Ajustar as políticas RLS de `esp32_status` com a mesma regra, para os sinais/heartbeat das máquinas também aparecerem corretamente.

3. Manter a segurança:
   - `super_admin` continua vendo tudo.
   - `admin` continua podendo gerenciar máquinas apenas nas lavanderias onde tem papel de admin.
   - `operator` passa a poder visualizar máquinas/status da lavanderia onde tem papel de operador.
   - operador não ganha permissão de criar, editar ou excluir máquinas.

4. Revisar a seleção de papel no frontend para não tratar usuário com `admin` em uma lavanderia e `operator` em outra como admin global da lavanderia errada.

5. Depois da migração, validar que a consulta para `/admin/machines` retorna as máquinas da lavanderia `TOP LAVANDERIA SINUELO` para o operador atual.
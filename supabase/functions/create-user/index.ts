import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AppRole = 'super_admin' | 'admin' | 'operator' | 'user' | 'totem_device'

interface CreateUserBody {
  email?: string
  password?: string
  role?: AppRole
  laundry_id?: string | null
  full_name?: string
}

interface RoleInsert {
  user_id: string
  role: AppRole
  laundry_id?: string | null
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar autenticação do usuário que está chamando
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se o usuário tem permissão (super_admin ou admin)
    const { data: rolesData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', user.id)

    if (roleError || !rolesData || rolesData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Usuário sem permissões' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usar a role de maior privilégio
    const roleOrder = ['super_admin', 'admin', 'operator', 'user', 'totem_device']
    const roles = rolesData.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))[0]

    const isSuperAdmin = roles.role === 'super_admin'
    const isAdmin = roles.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pegar dados do body
    const { email, password, role, laundry_id, full_name } = await req.json() as CreateUserBody

    // Validações
    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar se admin está tentando criar usuário em outra lavanderia
    if (isAdmin && !isSuperAdmin && laundry_id && laundry_id !== roles.laundry_id) {
      return new Response(
        JSON.stringify({ error: 'Admin só pode criar usuários na sua própria lavanderia' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar se está tentando criar super_admin sem ser super_admin
    if (role === 'super_admin' && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas super admins podem criar outros super admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Tentar criar o usuário usando admin API
    let userId: string
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split('@')[0]
      }
    })

    if (createError) {
      // Se o usuário já existe, buscar o ID dele para atribuir a role
      if (createError.message?.includes('already been registered')) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError
        const existingUser = users?.find(u => u.email === email)
        if (!existingUser) throw new Error('Usuário existe mas não foi encontrado')
        userId = existingUser.id
      } else {
        throw createError
      }
    } else {
      if (!newUser.user) throw new Error('Erro ao criar usuário')
      userId = newUser.user.id
    }

    // Aguardar trigger criar o perfil
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Criar role do usuário
    const roleData: RoleInsert = {
      user_id: userId,
      role: role,
    }

    // Se não for super_admin, adiciona laundry_id
    if (role !== 'super_admin') {
      roleData.laundry_id = laundry_id || (isAdmin ? roles.laundry_id : null)
    }

    // Verificar se já existe essa role para o usuário
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle()

    if (existingRole) {
      return new Response(
        JSON.stringify({ error: 'Este usuário já possui essa função' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: roleError2 } = await supabaseAdmin
      .from('user_roles')
      .insert([roleData])

    if (roleError2) throw roleError2

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: userId,
          email: email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
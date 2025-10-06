import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se o usuário tem permissão (super_admin ou admin)
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roles) {
      return new Response(
        JSON.stringify({ error: 'Usuário sem permissões' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isSuperAdmin = roles.role === 'super_admin'
    const isAdmin = roles.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pegar dados do body
    const { email, password, role, laundry_id, full_name } = await req.json()

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

    // Criar o usuário usando admin API (não faz autologin)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split('@')[0]
      }
    })

    if (createError) throw createError
    if (!newUser.user) throw new Error('Erro ao criar usuário')

    // Aguardar trigger criar o perfil
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Criar role do usuário
    const roleData: any = {
      user_id: newUser.user.id,
      role: role,
    }

    // Se não for super_admin, adiciona laundry_id
    if (role !== 'super_admin') {
      roleData.laundry_id = laundry_id || (isAdmin ? roles.laundry_id : null)
    }

    const { error: roleError2 } = await supabaseAdmin
      .from('user_roles')
      .insert([roleData])

    if (roleError2) {
      // Se falhou ao criar role, deletar o usuário criado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw roleError2
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
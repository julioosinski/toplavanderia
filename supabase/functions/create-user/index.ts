import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { z } from 'https://esm.sh/zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const APP_ROLES = ['super_admin', 'admin', 'manager', 'operator', 'user', 'totem_device'] as const
type AppRole = typeof APP_ROLES[number]

/**
 * Quem pode cadastrar qual perfil (espelha public.can_manage_user_role no banco):
 * - super_admin: qualquer perfil, em qualquer lavanderia
 * - admin (dono): gerente, operador, usuário e totem da própria lavanderia
 * - manager (gerente): apenas operador da própria lavanderia
 */
const CREATABLE_ROLES: Record<'admin' | 'manager', readonly AppRole[]> = {
  admin: ['manager', 'operator', 'user', 'totem_device'],
  manager: ['operator'],
}

/** Perfis cuja liberação manual de máquinas depende de autorização explícita. */
const RELEASE_PERMISSION_ROLES: readonly AppRole[] = ['manager', 'operator']

const limitCentsSchema = z.number().int().min(0).max(100_000_000).nullable().optional()

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(254),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
  role: z.enum(APP_ROLES),
  laundry_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().max(120).optional(),
  can_release: z.boolean().optional(),
  daily_limit_cents: limitCentsSchema,
  monthly_limit_cents: limitCentsSchema,
})

interface CallerRole {
  role: AppRole
  laundry_id: string | null
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado'
}

const isAlreadyRegisteredError = (message: string | undefined) =>
  Boolean(message && /already (been )?registered|already exists/i.test(message))

/** Busca usuário existente por e-mail (apenas fluxo de super_admin). */
const findUserIdByEmail = async (admin: SupabaseClient, email: string): Promise<string | null> => {
  const perPage = 1000
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) return match.id
    if (data.users.length < perPage) return null
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return jsonResponse({ error: 'Não autorizado' }, 401)

    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !caller) return jsonResponse({ error: 'Não autorizado' }, 401)

    const { data: rolesData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', caller.id)
      .returns<CallerRole[]>()

    if (roleError || !rolesData || rolesData.length === 0) {
      return jsonResponse({ error: 'Usuário sem permissões' }, 403)
    }

    const parsed = createUserSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, 400)
    }
    const body = parsed.data

    const isSuperAdmin = rolesData.some((r) => r.role === 'super_admin')

    let targetLaundryId: string | null = null
    let grantedAs: 'super_admin' | 'admin' | 'manager'

    if (isSuperAdmin) {
      grantedAs = 'super_admin'
      if (body.role !== 'super_admin') {
        if (!body.laundry_id) return jsonResponse({ error: 'Informe a lavanderia do novo usuário' }, 400)
        targetLaundryId = body.laundry_id
      }
    } else {
      const scopedRole =
        rolesData.find((r) => r.role === 'admin' && (!body.laundry_id || r.laundry_id === body.laundry_id)) ??
        rolesData.find((r) => r.role === 'manager' && (!body.laundry_id || r.laundry_id === body.laundry_id))

      if (!scopedRole || !scopedRole.laundry_id) {
        return jsonResponse({ error: 'Apenas administrador, dono ou gerente da lavanderia podem criar cadastros' }, 403)
      }

      grantedAs = scopedRole.role as 'admin' | 'manager'
      targetLaundryId = scopedRole.laundry_id

      if (!CREATABLE_ROLES[grantedAs].includes(body.role)) {
        const message = grantedAs === 'manager'
          ? 'Gerente só pode cadastrar operadores'
          : 'Dono da lavanderia não pode cadastrar este perfil'
        return jsonResponse({ error: message }, 403)
      }
    }

    // Criação
    let userId: string
    let isNewUser = false
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name || body.email.split('@')[0] },
    })

    if (createError) {
      if (!isAlreadyRegisteredError(createError.message)) throw createError
      // Anexar papel a conta existente permitiria sequestrar contas de terceiros; só super_admin pode.
      if (!isSuperAdmin) {
        return jsonResponse({ error: 'Este e-mail já está cadastrado. Use outro e-mail.' }, 409)
      }
      const existingId = await findUserIdByEmail(supabaseAdmin, body.email)
      if (!existingId) throw new Error('Usuário existe mas não foi encontrado')
      userId = existingId
    } else {
      if (!newUser.user) throw new Error('Erro ao criar usuário')
      userId = newUser.user.id
      isNewUser = true
    }

    const rollbackNewUser = async () => {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined)
    }

    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', body.role)
      .maybeSingle()

    if (existingRole) {
      return jsonResponse({ error: 'Este usuário já possui essa função' }, 409)
    }

    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: userId, role: body.role, laundry_id: targetLaundryId }])

    if (insertRoleError) {
      await rollbackNewUser()
      throw insertRoleError
    }

    let canRelease: boolean | null = null
    if (RELEASE_PERMISSION_ROLES.includes(body.role) && targetLaundryId) {
      canRelease = body.can_release ?? false
      const { error: permError } = await supabaseAdmin
        .from('operator_release_permissions')
        .upsert(
          {
            user_id: userId,
            laundry_id: targetLaundryId,
            can_release: canRelease,
            daily_limit_cents: body.daily_limit_cents ?? null,
            monthly_limit_cents: body.monthly_limit_cents ?? null,
            granted_by: caller.id,
          },
          { onConflict: 'user_id,laundry_id' }
        )

      if (permError) {
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId).eq('role', body.role)
        await rollbackNewUser()
        throw permError
      }
    }

    console.log('User created', { by: caller.id, as: grantedAs, role: body.role, laundry: targetLaundryId, canRelease })

    return jsonResponse({
      success: true,
      user: { id: userId, email: body.email },
      can_release: canRelease,
    })
  } catch (error: unknown) {
    console.error('Error creating user:', error)
    return jsonResponse({ error: getErrorMessage(error) }, 500)
  }
})

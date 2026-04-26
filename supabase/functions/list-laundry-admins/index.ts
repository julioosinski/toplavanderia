import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  laundry_id: string | null;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro inesperado";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { laundry_id } = (await req.json()) as { laundry_id?: string };
    if (!laundry_id) {
      return new Response(JSON.stringify({ error: "laundry_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles, error: callerRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, laundry_id")
      .eq("user_id", user.id);

    if (callerRoleError || !callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Usuário sem permissões" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles.some((role) => role.role === "super_admin");
    const isLaundryAdmin = callerRoles.some(
      (role) => role.role === "admin" && role.laundry_id === laundry_id
    );

    if (!isSuperAdmin && !isLaundryAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão para listar administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRoles, error: adminRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, laundry_id")
      .eq("laundry_id", laundry_id)
      .eq("role", "admin")
      .returns<UserRole[]>();

    if (adminRolesError) throw adminRolesError;

    const userIds = (adminRoles ?? []).map((role) => role.user_id);
    let profilesByUserId: Record<string, Profile> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds)
        .returns<Profile[]>();

      if (profilesError) throw profilesError;

      profilesByUserId = Object.fromEntries(
        (profiles ?? []).map((profile) => [profile.user_id, profile])
      );
    }

    const admins = await Promise.all(
      (adminRoles ?? []).map(async (adminRole) => {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(adminRole.user_id);

        return {
          id: adminRole.id,
          user_id: adminRole.user_id,
          role: adminRole.role,
          email: authData.user?.email ?? "N/A",
          profiles: {
            full_name: profilesByUserId[adminRole.user_id]?.full_name ?? null,
            user_id: adminRole.user_id,
          },
        };
      })
    );

    return new Response(JSON.stringify({ admins }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error listing laundry admins:", error);

    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-esp32-monitor-secret",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado";

const isDeviceAuthorized = (req: Request) => {
  const secret = Deno.env.get("ESP32_MONITOR_SECRET");
  if (!secret) return true;
  return req.headers.get("x-esp32-monitor-secret") === secret;
};

const isAuthenticatedUser = async (
  req: Request,
  supabase: ReturnType<typeof createClient>,
) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user ?? null;
};

const isAdminForLaundry = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  laundryId: string,
) => {
  const { data: superAdmin } = await supabase.rpc("is_super_admin", {
    _user_id: userId,
  });
  if (superAdmin) return true;

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, laundry_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return role?.laundry_id === laundryId;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "poll";

    // ==================== POLL (ESP32) ====================
    if (action === "poll" && req.method === "GET") {
      if (!isDeviceAuthorized(req)) {
        return json({ success: false, error: "OTA poll não autorizado" }, 401);
      }

      const esp32_id = url.searchParams.get("esp32_id");
      if (!esp32_id) {
        return json({ success: false, error: "esp32_id required" }, 400);
      }

      const { data: job, error } = await supabase
        .from("esp32_ota_jobs")
        .select("*")
        .eq("esp32_id", esp32_id)
        .in("status", ["pending", "downloading"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!job) {
        return json({ success: true, ota: null });
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from("esp32-firmware")
        .createSignedUrl(job.storage_path, 60 * 60);

      if (signErr || !signed?.signedUrl) {
        throw new Error(signErr?.message ?? "Falha ao gerar URL assinada");
      }

      if (job.status === "pending") {
        await supabase
          .from("esp32_ota_jobs")
          .update({
            status: "downloading",
            started_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }

      return json({
        success: true,
        ota: {
          job_id: job.id,
          version: job.firmware_version,
          url: signed.signedUrl,
          size: job.file_size,
          sha256: job.checksum_sha256,
        },
      });
    }

    // ==================== COMPLETE / FAIL (ESP32) ====================
    if (action === "report" && req.method === "POST") {
      if (!isDeviceAuthorized(req)) {
        return json({ success: false, error: "OTA report não autorizado" }, 401);
      }

      const body = await req.json();
      const { job_id, esp32_id, success, error_message, firmware_version } = body;

      if (!job_id || !esp32_id) {
        return json({ success: false, error: "job_id e esp32_id obrigatórios" }, 400);
      }

      const patch: Record<string, unknown> = {
        status: success ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        error_message: success ? null : (error_message ?? "OTA falhou"),
      };

      if (success && firmware_version) {
        patch.firmware_version = firmware_version;
      }

      const { error } = await supabase
        .from("esp32_ota_jobs")
        .update(patch)
        .eq("id", job_id)
        .eq("esp32_id", esp32_id);

      if (error) throw error;
      return json({ success: true });
    }

    // ==================== SCHEDULE (Admin) ====================
    if (action === "schedule" && req.method === "POST") {
      const user = await isAuthenticatedUser(req, supabase);
      if (!user) {
        return json({ success: false, error: "Não autenticado" }, 401);
      }

      const body = await req.json();
      const {
        laundry_id,
        esp32_id,
        firmware_version,
        storage_path,
        file_size,
        checksum_sha256,
      } = body;

      if (!laundry_id || !esp32_id || !firmware_version || !storage_path) {
        return json({
          success: false,
          error: "laundry_id, esp32_id, firmware_version e storage_path são obrigatórios",
        }, 400);
      }

      if (!(await isAdminForLaundry(supabase, user.id, laundry_id))) {
        return json({ success: false, error: "Sem permissão para esta lavanderia" }, 403);
      }

      await supabase
        .from("esp32_ota_jobs")
        .update({ status: "cancelled" })
        .eq("esp32_id", esp32_id)
        .in("status", ["pending", "downloading"]);

      const { data: job, error } = await supabase
        .from("esp32_ota_jobs")
        .insert({
          laundry_id,
          esp32_id,
          firmware_version,
          storage_path,
          file_size: file_size ?? null,
          checksum_sha256: checksum_sha256 ?? null,
          status: "pending",
          created_by: user.id,
        })
        .select("id, firmware_version, status, created_at")
        .single();

      if (error) throw error;

      return json({
        success: true,
        job,
        message: "Atualização OTA enfileirada. O ESP32 aplicará na próxima poll (~5s).",
      });
    }

    // ==================== LIST (Admin) ====================
    if (action === "list" && req.method === "GET") {
      const user = await isAuthenticatedUser(req, supabase);
      if (!user) {
        return json({ success: false, error: "Não autenticado" }, 401);
      }

      const laundry_id = url.searchParams.get("laundry_id");
      const esp32_id = url.searchParams.get("esp32_id");
      if (!laundry_id) {
        return json({ success: false, error: "laundry_id required" }, 400);
      }

      if (!(await isAdminForLaundry(supabase, user.id, laundry_id))) {
        return json({ success: false, error: "Sem permissão" }, 403);
      }

      let query = supabase
        .from("esp32_ota_jobs")
        .select("*")
        .eq("laundry_id", laundry_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (esp32_id) {
        query = query.eq("esp32_id", esp32_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return json({ success: true, jobs: data ?? [] });
    }

    return json({
      success: false,
      error: "Ação inválida. Use poll, report, schedule ou list.",
    }, 400);
  } catch (error: unknown) {
    console.error("esp32-firmware-ota error:", error);
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected error";

const isCronAuthorized = (req: Request) => {
  const secret = Deno.env.get("RECONCILE_PAYMENTS_CRON_SECRET")
    ?? Deno.env.get("AUTO_RELEASE_CRON_SECRET");
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
};

type CieloSettings = {
  cielo_client_id: string | null;
  cielo_access_token: string | null;
  cielo_merchant_code: string | null;
  cielo_environment: string | null;
};

type OrphanRow = {
  transaction_id: string;
  machine_id: string;
  esp32_id: string;
  relay_pin: number;
  cycle_time_minutes: number;
  payment_method: string | null;
  total_amount: number;
  created_at: string;
  has_in_flight_command: boolean;
  cielo_payment_id: string | null;
};

type PaymentSessionRow = {
  id: string;
  external_reference: string | null;
  cielo_order_id: string | null;
  laundry_id: string;
  provider: string;
  state: string;
};

const cieloBaseUrl = (environment: string | null | undefined) =>
  environment?.toLowerCase() === "sandbox"
    ? "https://api.cielo.com.br/sandbox-lio/order-management/v1"
    : "https://api.cielo.com.br/order-management/v1";

const fetchCieloOrderByReference = async (
  settings: CieloSettings,
  reference: string,
): Promise<{ paid: boolean; orderId?: string; paymentId?: string; status?: string }> => {
  const clientId = settings.cielo_client_id?.trim();
  const accessToken = settings.cielo_access_token?.trim();
  if (!clientId || !accessToken || !reference) {
    return { paid: false };
  }

  const base = cieloBaseUrl(settings.cielo_environment);
  const merchant = settings.cielo_merchant_code?.trim() ?? "";
  const query = `reference=${encodeURIComponent(reference)}&page=0&page_size=5`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "client-id": clientId,
    "access-token": accessToken,
  };
  if (merchant) headers["merchant-id"] = merchant;

  try {
    const res = await fetch(`${base}/orders/?${query}`, { headers });
    if (!res.ok) {
      console.warn(`Cielo list orders HTTP ${res.status} ref=${reference}`);
      return { paid: false };
    }
    const body = await res.json();
    const orders = Array.isArray(body)
      ? body
      : Array.isArray(body?.results)
      ? body.results
      : [];

    for (const order of orders) {
      const ref = String(order?.reference ?? order?.number ?? "");
      if (ref !== reference) continue;
      const status = String(order?.status ?? "").toUpperCase();
      const paid = ["PAID", "CLOSED"].includes(status);
      const payments = order?.payments ?? order?.Transactions ?? [];
      const firstPayment = Array.isArray(payments) ? payments[0] : null;
      return {
        paid,
        orderId: order?.id ? String(order.id) : undefined,
        paymentId: firstPayment?.id ? String(firstPayment.id) : undefined,
        status,
      };
    }
  } catch (e) {
    console.warn("Cielo order lookup failed:", getErrorMessage(e));
  }
  return { paid: false };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isCronAuthorized(req)) {
      return new Response(
        JSON.stringify({ error: "Cron unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expired = await supabase.rpc("expire_stale_payment_sessions", { _max_age_minutes: 30 });
    if (expired.error) {
      console.warn("expire_stale_payment_sessions:", expired.error.message);
    }

    const reclaimed = await supabase.rpc("reclaim_stale_processing_esp32_commands");
    if (reclaimed.error) {
      console.warn("reclaim_stale_processing_esp32_commands:", reclaimed.error.message);
    }

    const { data: orphans, error: orphanErr } = await supabase.rpc("list_orphan_totem_releases", {
      _min_age_seconds: 45,
      _max_age_minutes: 360,
    });

    if (orphanErr) {
      return new Response(
        JSON.stringify({ error: orphanErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Record<string, unknown>[] = [];
    const settingsCache = new Map<string, CieloSettings | null>();

    for (const row of (orphans ?? []) as OrphanRow[]) {
      const outcome: Record<string, unknown> = {
        transaction_id: row.transaction_id,
        action: "skipped",
      };

      const { data: session } = await supabase
        .from("payment_sessions")
        .select("id, external_reference, cielo_order_id, laundry_id, provider, state")
        .eq("transaction_id", row.transaction_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<PaymentSessionRow>();

      const alreadyAuthorized = Boolean(row.cielo_payment_id);
      let shouldRelease = alreadyAuthorized;

      if (!alreadyAuthorized && session?.external_reference && session.provider === "cielo") {
        let settings = settingsCache.get(session.laundry_id);
        if (settings === undefined) {
          const { data } = await supabase
            .from("system_settings")
            .select("cielo_client_id, cielo_access_token, cielo_merchant_code, cielo_environment")
            .eq("laundry_id", session.laundry_id)
            .maybeSingle<CieloSettings>();
          settings = data ?? null;
          settingsCache.set(session.laundry_id, settings);
        }

        if (settings) {
          const cielo = await fetchCieloOrderByReference(settings, session.external_reference);
          outcome.cielo_status = cielo.status;
          if (cielo.paid) {
            await supabase.rpc("mark_totem_payment_authorized", {
              _transaction_id: row.transaction_id,
              _payment_method: row.payment_method,
              _cielo_payment_id: cielo.paymentId ?? null,
              _amount_cents: Math.round(Number(row.total_amount) * 100),
              _extra: { reconciled_by: "reconcile-payments", cielo_order_id: cielo.orderId ?? null },
            });
            if (session.id && cielo.orderId) {
              await supabase.rpc("update_payment_session", {
                _session_id: session.id,
                _state: "RECONCILED",
                _cielo_order_id: cielo.orderId,
                _cielo_payment_id: cielo.paymentId ?? null,
                _extra: { reconciled_at: new Date().toISOString() },
              });
            }
            shouldRelease = true;
            outcome.action = "marked_authorized_via_cielo";
          }
        }
      } else if (alreadyAuthorized) {
        outcome.action = "already_authorized";
        shouldRelease = true;
      }

      if (shouldRelease && !row.has_in_flight_command) {
        const { data: commandId, error: enqueueErr } = await supabase.rpc(
          "enqueue_totem_machine_release",
          { _transaction_id: row.transaction_id },
        );
        if (enqueueErr) {
          outcome.enqueue_error = enqueueErr.message;
        } else {
          outcome.command_id = commandId;
          outcome.action = outcome.action === "skipped" ? "enqueued_release" : `${outcome.action}+enqueued`;
        }
      }

      results.push(outcome);
    }

    return new Response(
      JSON.stringify({
        expired_sessions: expired.data ?? 0,
        orphans_checked: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: getErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

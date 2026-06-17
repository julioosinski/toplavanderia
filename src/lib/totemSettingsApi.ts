export interface TotemPaymentCredentials {
  paygo_provedor?: string | null;
  cielo_client_id?: string | null;
  cielo_access_token?: string | null;
  cielo_merchant_code?: string | null;
  cielo_environment?: string | null;
}

const TOTEM_SETTINGS_SECRET = import.meta.env.VITE_TOTEM_SETTINGS_SECRET as string | undefined;

const getSupabaseUrl = () =>
  import.meta.env.VITE_SUPABASE_URL || 'https://rkdybjzwiwwqqzjfmerm.supabase.co';

const getSupabaseAnonKey = () =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg';

/**
 * Busca credenciais de pagamento via edge function (autorizado por segredo).
 * Necessário após remoção das credenciais Cielo do RPC público get_totem_settings.
 */
export async function fetchTotemPaymentCredentials(
  laundryId: string
): Promise<TotemPaymentCredentials | null> {
  if (!laundryId || !TOTEM_SETTINGS_SECRET?.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getSupabaseUrl()}/functions/v1/totem-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
        'x-totem-settings-secret': TOTEM_SETTINGS_SECRET.trim(),
      },
      body: JSON.stringify({ laundry_id: laundryId }),
    });

    if (!response.ok) {
      console.warn('[totemSettingsApi] totem-settings HTTP', response.status);
      return null;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      settings?: TotemPaymentCredentials;
      error?: string;
    };

    if (!payload.success || !payload.settings) {
      console.warn('[totemSettingsApi] totem-settings:', payload.error ?? 'sem settings');
      return null;
    }

    return payload.settings;
  } catch (error) {
    console.warn('[totemSettingsApi] falha ao buscar credenciais:', error);
    return null;
  }
}

/** Mescla credenciais Cielo do edge function quando o RPC público não as retorna. */
export async function enrichSettingsWithPaymentCredentials<T extends TotemPaymentCredentials>(
  laundryId: string,
  base: T
): Promise<T> {
  const hasCreds = Boolean(base.cielo_client_id?.trim() && base.cielo_access_token?.trim());
  if (hasCreds) return base;

  const fromEdge = await fetchTotemPaymentCredentials(laundryId);
  if (!fromEdge) return base;

  return {
    ...base,
    paygo_provedor: fromEdge.paygo_provedor ?? base.paygo_provedor,
    cielo_client_id: fromEdge.cielo_client_id ?? base.cielo_client_id,
    cielo_access_token: fromEdge.cielo_access_token ?? base.cielo_access_token,
    cielo_merchant_code: fromEdge.cielo_merchant_code ?? base.cielo_merchant_code,
    cielo_environment: fromEdge.cielo_environment ?? base.cielo_environment,
  };
}

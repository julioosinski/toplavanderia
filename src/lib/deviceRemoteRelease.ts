import { supabase } from '@/integrations/supabase/client';

export async function adminRemoteRelease(params: {
  machineId: string;
  productId?: string | null;
  valorCentavos?: number | null;
}): Promise<{ commandId: string | null; error: Error | null }> {
  const { machineId, productId, valorCentavos } = params;

  const { data, error } = await supabase.rpc('admin_remote_release', {
    _machine_id: machineId,
    _product_id: productId ?? null,
    _valor_centavos: valorCentavos ?? null,
  });

  if (error) {
    return { commandId: null, error: error as Error };
  }

  return { commandId: typeof data === 'string' ? data : null, error: null };
}

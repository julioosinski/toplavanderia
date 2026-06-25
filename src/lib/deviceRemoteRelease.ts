import { supabase } from '@/integrations/supabase/client';
import { reaisToCentavos } from '@/lib/money';

export async function adminRemoteRelease(params: {
  machineId: string;
  productId?: string | null;
  /** Valor já em centavos (850 = R$ 8,50). Preferir valorReais na UI. */
  valorCentavos?: number | null;
  /** Valor em reais (8.5 ou "8,50") — convertido para centavos antes do RPC. */
  valorReais?: number | string | null;
}): Promise<{ commandId: string | null; error: Error | null }> {
  const { machineId, productId, valorCentavos, valorReais } = params;

  const centsFromReais = valorReais != null ? reaisToCentavos(valorReais) : 0;
  const resolvedCentavos =
    valorCentavos != null && valorCentavos > 0
      ? Math.round(valorCentavos)
      : centsFromReais > 0
        ? centsFromReais
        : null;

  const { data, error } = await supabase.rpc('admin_remote_release', {
    _machine_id: machineId,
    _product_id: productId ?? null,
    _valor_centavos: resolvedCentavos,
  });

  if (error) {
    return { commandId: null, error: error as Error };
  }

  return { commandId: typeof data === 'string' ? data : null, error: null };
}

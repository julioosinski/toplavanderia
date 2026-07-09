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
    // Loga tudo que o PostgREST devolveu para diagnóstico (message/details/hint/code)
    console.error('[adminRemoteRelease] RPC error', {
      message: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
      code: (error as { code?: string }).code,
    });

    const err = error as { message?: string; details?: string; hint?: string; code?: string };
    const finalMessage =
      err.message?.trim() ||
      err.details?.trim() ||
      err.hint?.trim() ||
      'Erro ao liberar máquina (sem detalhes).';

    return { commandId: null, error: new Error(finalMessage) };
  }

  return { commandId: typeof data === 'string' ? data : null, error: null };
}

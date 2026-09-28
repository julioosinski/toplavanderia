/**
 * Extrai a mensagem de erro retornada por uma Edge Function.
 * `supabase.functions.invoke` devolve um FunctionsHttpError genérico em respostas não-2xx;
 * o corpo JSON ({ error }) fica em `error.context` (Response).
 */
export const getEdgeFunctionErrorMessage = async (error: unknown, fallback = 'Erro inesperado'): Promise<string> => {
  if (!error) return fallback;

  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    const payload = (await context.clone().json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
    if (payload && typeof payload.error === 'string' && payload.error) return payload.error;
    if (payload && typeof payload.message === 'string' && payload.message) return payload.message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

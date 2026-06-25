/** Liberações manuais (admin) — registram valor operacional, não entram na receita financeira. */
export const MANUAL_RELEASE_PAYMENT_METHOD = 'manual_release';

export function isManualRelease(paymentMethod: string | null | undefined): boolean {
  return paymentMethod === MANUAL_RELEASE_PAYMENT_METHOD;
}

/** Valor que compõe receita em relatórios e dashboards. */
export function billableRevenueAmount(
  totalAmount: number | string | null | undefined,
  paymentMethod: string | null | undefined,
): number {
  if (isManualRelease(paymentMethod)) {
    return 0;
  }
  return Number(totalAmount) || 0;
}

/** Valor exibido na linha da transação (inclui liberação manual). */
export function displayTransactionAmount(totalAmount: number | string | null | undefined): number {
  return Number(totalAmount) || 0;
}

/** Normaliza respostas do servidor de automação PayGO (formatos variam por versão). */

export function extractPixQrFields(body: Record<string, unknown>): {
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  transactionId?: string;
  orderId?: string;
  expiresIn?: number;
} {
  const dataNested =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null;
  const src: Record<string, unknown> = dataNested ? { ...dataNested, ...body } : body;

  const qrCode =
    (typeof src.qrCode === 'string' && src.qrCode) ||
    (typeof src.qr_code === 'string' && src.qr_code) ||
    (typeof src.QRCode === 'string' && src.QRCode) ||
    (typeof src.payload === 'string' && src.payload) ||
    (typeof src.emv === 'string' && src.emv) ||
    (typeof src.pixCopiaECola === 'string' && src.pixCopiaECola) ||
    (typeof src.copiaECola === 'string' && src.copiaECola) ||
    (typeof src.brCode === 'string' && src.brCode) ||
    (typeof src.qrcode === 'string' && src.qrcode) ||
    (typeof src.qrCodeText === 'string' && src.qrCodeText) ||
    undefined;

  const qrCodeBase64 =
    (typeof src.qrCodeBase64 === 'string' && src.qrCodeBase64) ||
    (typeof src.qr_code_base64 === 'string' && src.qr_code_base64) ||
    (typeof src.imageBase64 === 'string' && src.imageBase64) ||
    (typeof src.qrCodeImage === 'string' && src.qrCodeImage) ||
    undefined;

  const pixKey =
    (typeof src.pixKey === 'string' && src.pixKey) ||
    (typeof src.pix_key === 'string' && src.pix_key) ||
    undefined;

  const transactionId =
    (typeof src.transactionId === 'string' && src.transactionId) ||
    (typeof src.transaction_id === 'string' && src.transaction_id) ||
    (typeof src.id === 'string' && src.id) ||
    undefined;

  const exp = src.expiresIn ?? src.expires_in ?? src.expirationSeconds;
  const expiresIn = typeof exp === 'number' ? exp : typeof exp === 'string' ? parseInt(exp, 10) : undefined;

  const orderId =
    (typeof src.orderId === 'string' && src.orderId) ||
    (typeof src.order_id === 'string' && src.order_id) ||
    (typeof src.externalId === 'string' && src.externalId) ||
    (typeof src.external_id === 'string' && src.external_id) ||
    undefined;

  return {
    qrCode,
    qrCodeBase64,
    pixKey,
    transactionId,
    orderId,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

export function normalizePixPaymentStatus(raw: unknown): 'pending' | 'paid' | 'expired' | 'cancelled' {
  if (raw === true) return 'paid';
  if (raw === 1 || raw === '1') return 'paid';
  const s = String(raw ?? 'pending')
    .trim()
    .toLowerCase();
  if (
    [
      'paid',
      'approved',
      'confirmed',
      'pago',
      'aprovado',
      'success',
      'completed',
      'concluido',
      'concluído',
      'liquidado',
      'settled',
      '00',
      'ok',
    ].includes(s)
  ) {
    return 'paid';
  }
  if (['expired', 'expirado', 'timeout', 'expired_payment'].includes(s)) return 'expired';
  if (['cancelled', 'canceled', 'cancelado', 'revoked'].includes(s)) return 'cancelled';
  if (['denied', 'rejected', 'failed', 'declined'].includes(s)) return 'cancelled';
  return 'pending';
}

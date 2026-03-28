/** Normaliza respostas do servidor de automação PayGO (formatos variam por versão). */

export function extractPixQrFields(body: Record<string, unknown>): {
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  transactionId?: string;
  expiresIn?: number;
} {
  const qrCode =
    (typeof body.qrCode === 'string' && body.qrCode) ||
    (typeof body.qr_code === 'string' && body.qr_code) ||
    (typeof body.QRCode === 'string' && body.QRCode) ||
    (typeof body.payload === 'string' && body.payload) ||
    (typeof body.emv === 'string' && body.emv) ||
    (typeof body.pixCopiaECola === 'string' && body.pixCopiaECola) ||
    (typeof body.copiaECola === 'string' && body.copiaECola) ||
    undefined;

  const qrCodeBase64 =
    (typeof body.qrCodeBase64 === 'string' && body.qrCodeBase64) ||
    (typeof body.qr_code_base64 === 'string' && body.qr_code_base64) ||
    (typeof body.imageBase64 === 'string' && body.imageBase64) ||
    (typeof body.qrCodeImage === 'string' && body.qrCodeImage) ||
    undefined;

  const pixKey =
    (typeof body.pixKey === 'string' && body.pixKey) ||
    (typeof body.pix_key === 'string' && body.pix_key) ||
    undefined;

  const transactionId =
    (typeof body.transactionId === 'string' && body.transactionId) ||
    (typeof body.transaction_id === 'string' && body.transaction_id) ||
    (typeof body.id === 'string' && body.id) ||
    undefined;

  const exp = body.expiresIn ?? body.expires_in ?? body.expirationSeconds;
  const expiresIn = typeof exp === 'number' ? exp : typeof exp === 'string' ? parseInt(exp, 10) : undefined;

  return {
    qrCode,
    qrCodeBase64,
    pixKey,
    transactionId,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

export function normalizePixPaymentStatus(raw: unknown): 'pending' | 'paid' | 'expired' | 'cancelled' {
  const s = String(raw ?? 'pending')
    .trim()
    .toLowerCase();
  if (['paid', 'approved', 'confirmed', 'pago', 'aprovado'].includes(s)) return 'paid';
  if (['expired', 'expirado', 'timeout'].includes(s)) return 'expired';
  if (['cancelled', 'canceled', 'cancelado'].includes(s)) return 'cancelled';
  return 'pending';
}

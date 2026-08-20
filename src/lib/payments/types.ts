/**
 * Contratos compartilhados de pagamento — Cielo (ativo) e Stone (fase B).
 * Pulso ESP32 permanece 1000ms (credit_pulse); não alterar aqui.
 */

export type PaymentProvider = "cielo" | "stone" | "paygo" | "manual";

export type PaymentSessionState =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REVERSED"
  | "EXPIRED"
  | "RECONCILIATION_PENDING"
  | "RECONCILED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "ERROR";

/** Estados que bloqueiam nova sessão na mesma máquina. */
export const ACTIVE_PAYMENT_SESSION_STATES: PaymentSessionState[] = [
  "CREATED",
  "PAYMENT_PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "APPROVED",
  "RECONCILIATION_PENDING",
  "RELEASE_PENDING",
];

export interface PaymentTerminal {
  id: string;
  laundry_id: string;
  provider: PaymentProvider;
  label: string;
  device_serial?: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface PaymentSession {
  id: string;
  laundry_id: string;
  machine_id?: string | null;
  transaction_id?: string | null;
  provider: PaymentProvider;
  state: PaymentSessionState;
  amount_cents: number;
  external_reference?: string | null;
  cielo_order_id?: string | null;
  cielo_payment_id?: string | null;
  stone_transaction_id?: string | null;
  authorized_at?: string | null;
  released_at?: string | null;
  created_at: string;
}

/** Adapter comum — CieloLioManager (Android) implementa hoje; Stone SDK na fase B. */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  prepareCheckout(params: {
    amountCents: number;
    reference: string;
    paymentMethod: string;
    description: string;
  }): Promise<{ externalReference: string; orderId?: string } | null>;
  finalizeCheckout(orderId?: string): Promise<void>;
  requestReversal(params: {
    paymentId?: string;
    reference?: string;
    amountCents: number;
  }): Promise<boolean>;
}

export interface StoneCredentials {
  stone_code: string;
  stone_app_key: string;
  stone_environment: "sandbox" | "production";
  stone_device_serial?: string | null;
}

/** Placeholder Stone — implementar quando POS e credenciais estiverem definidos. */
export const stoneAdapterPlaceholder: PaymentProviderAdapter = {
  provider: "stone",
  async prepareCheckout() {
    throw new Error("Stone POS: integração planejada (fase B)");
  },
  async finalizeCheckout() {
    /* noop */
  },
  async requestReversal() {
    throw new Error("Stone POS: estorno não implementado");
  },
};

export interface PaymentDiagnosticRow {
  session_id: string;
  transaction_id: string | null;
  machine_id: string | null;
  machine_name: string | null;
  provider: string;
  session_state: string;
  transaction_status: string | null;
  amount_cents: number;
  payment_method: string | null;
  external_reference: string | null;
  cielo_order_id: string | null;
  cielo_payment_id: string | null;
  payment_authorized: boolean;
  needs_refund: boolean;
  reconciliation_pending: boolean;
  esp_command_status: string | null;
  has_in_flight_command: boolean;
  created_at: string;
  authorized_at: string | null;
  released_at: string | null;
}

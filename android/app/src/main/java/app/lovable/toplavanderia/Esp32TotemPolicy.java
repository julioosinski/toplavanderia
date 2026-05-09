package app.lovable.toplavanderia;

/**
 * Política de detecção de ESP32 no totem — manter alinhado a
 * {@code src/lib/machineEsp32Sync.ts} ({@code ESP32_TOTEM_HEARTBEAT_STALE_MS}).
 * Firmware envia heartbeat ~30s; 55s ≈ um ciclo perdido.
 */
public final class Esp32TotemPolicy {
    public static final long HEARTBEAT_STALE_MS = 55_000L;
    /** Intervalo entre polls do monitor em primeiro plano (trade-off rede vs. UX). */
    public static final int STATUS_POLL_INTERVAL_MS = 3_000;

    private Esp32TotemPolicy() {}
}
